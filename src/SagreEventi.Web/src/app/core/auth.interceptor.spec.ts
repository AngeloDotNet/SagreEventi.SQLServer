import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Mock } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { ConfigService } from './config.service';

const API = 'https://api.test';

/** Controllable stand-in for AuthService: the interceptor only needs these members. */
interface FakeAuth {
  token: string | null;
  scaduto: boolean;
  autenticato: boolean;
  rinnova: Mock<() => Promise<boolean>>;
}

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let auth: FakeAuth;

  const configura = (apiBaseUrl: string) => {
    auth = {
      token: 'token-1',
      scaduto: false,
      autenticato: true,
      rinnova: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: ConfigService, useValue: { apiBaseUrl: () => apiBaseUrl } },
        {
          provide: AuthService,
          useValue: {
            accessToken: () => auth.token,
            inScadenza: () => auth.scaduto,
            autenticato: () => auth.autenticato,
            rinnova: () => auth.rinnova(),
          },
        },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  };

  /** Lets the interceptor's promise-based steps (token renewal) run. */
  const attendi = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => configura(API));

  afterEach(() => {
    controller.verify();
    vi.restoreAllMocks();
  });

  describe('which requests get the token', () => {
    it('adds the Bearer token to requests to the configured API', () => {
      http.get(`${API}/api/Eventi/GetStati`).subscribe();

      const req = controller.expectOne(`${API}/api/Eventi/GetStati`);
      expect(req.request.headers.get('Authorization')).toBe('Bearer token-1');
      req.flush([]);
    });

    it('adds the token to same-origin requests when the API base URL is empty', () => {
      TestBed.resetTestingModule();
      configura('');

      http.get('/api/Eventi/GetStati').subscribe();

      const req = controller.expectOne('/api/Eventi/GetStati');
      expect(req.request.headers.get('Authorization')).toBe('Bearer token-1');
      req.flush([]);
    });

    it.each([
      ['another host', 'https://example.com/api/x'],
      ['a host that only starts like the API', 'https://api.test.evil.com/api/x'],
      ['a userinfo trick', 'https://api.test@evil.com/api/x'],
      ['another scheme', 'http://api.test/api/x'],
      ['a relative asset', 'config.json'],
    ])('never sends the token to %s', (_nome, url) => {
      http.get(url).subscribe();

      const req = controller.expectOne(url);
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush({});
      expect(auth.rinnova).not.toHaveBeenCalled();
    });

    // With an empty API base URL every URL starting with "/" is same-origin, except "//host" (protocol-relative)
    it('never sends the token to a protocol-relative URL when the API base URL is empty', () => {
      TestBed.resetTestingModule();
      configura('');

      http.get('//evil.example.com/api/x').subscribe();

      const req = controller.expectOne('//evil.example.com/api/x');
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush({});
    });

    it.each(['login', 'refresh', 'LOGIN'])('does not touch the %s request, even when the token is about to expire', (azione) => {
      auth.scaduto = true;

      http.post(`${API}/api/auth/${azione}`, {}).subscribe();

      const req = controller.expectOne(`${API}/api/auth/${azione}`);
      expect(req.request.headers.has('Authorization')).toBe(false);
      expect(auth.rinnova).not.toHaveBeenCalled();
      req.flush({});
    });

    it('sends anonymous requests as they are, without renewing', () => {
      auth.token = null;
      auth.autenticato = false;
      auth.scaduto = true;

      http.get(`${API}/api/Eventi/GetEventi`).subscribe();

      const req = controller.expectOne(`${API}/api/Eventi/GetEventi`);
      expect(req.request.headers.has('Authorization')).toBe(false);
      expect(auth.rinnova).not.toHaveBeenCalled();
      req.flush([]);
    });

    it('keeps an Authorization header already set by the caller', () => {
      http.get(`${API}/api/auth/me`, { headers: { Authorization: 'Bearer chiamante' } }).subscribe();

      const req = controller.expectOne(`${API}/api/auth/me`);
      expect(req.request.headers.get('Authorization')).toBe('Bearer chiamante');
      req.flush({});
    });
  });

  describe('renewal before sending', () => {
    it('renews an expiring token first and sends the request with the new one', async () => {
      auth.scaduto = true;
      auth.rinnova.mockImplementation(() => {
        auth.token = 'token-2';
        auth.scaduto = false;
        return Promise.resolve(true);
      });

      http.get(`${API}/api/Eventi/GetStati`).subscribe();
      controller.expectNone(`${API}/api/Eventi/GetStati`);
      await attendi();

      const req = controller.expectOne(`${API}/api/Eventi/GetStati`);
      expect(req.request.headers.get('Authorization')).toBe('Bearer token-2');
      expect(auth.rinnova).toHaveBeenCalledTimes(1);
      req.flush([]);
    });

    it('sends the request anonymous (never "Bearer null") when the renewal ends with a logout', async () => {
      auth.scaduto = true;
      auth.rinnova.mockImplementation(() => {
        auth.token = null;
        auth.autenticato = false;
        return Promise.resolve(false);
      });

      http.get(`${API}/api/Eventi/GetStati`).subscribe();
      await attendi();

      const req = controller.expectOne(`${API}/api/Eventi/GetStati`);
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush([]);
    });
  });

  describe('401 handling', () => {
    it('renews once and retries the request with the new token', async () => {
      auth.rinnova.mockImplementation(() => {
        auth.token = 'token-2';
        return Promise.resolve(true);
      });
      const risposta = firstValueFrom(http.get<string[]>(`${API}/api/Eventi/GetStati`));

      const primo = controller.expectOne(`${API}/api/Eventi/GetStati`);
      expect(primo.request.headers.get('Authorization')).toBe('Bearer token-1');
      primo.flush({}, { status: 401, statusText: 'Unauthorized' });
      await attendi();

      const secondo = controller.expectOne(`${API}/api/Eventi/GetStati`);
      expect(secondo.request.headers.get('Authorization')).toBe('Bearer token-2');
      secondo.flush(['ok']);

      await expect(risposta).resolves.toEqual(['ok']);
      expect(auth.rinnova).toHaveBeenCalledTimes(1);
    });

    it('does not retry a second time when the retry is rejected as well', async () => {
      auth.rinnova.mockImplementation(() => {
        auth.token = 'token-2';
        return Promise.resolve(true);
      });
      const risposta = firstValueFrom(http.get(`${API}/api/Eventi/GetStati`));

      controller.expectOne(`${API}/api/Eventi/GetStati`).flush({}, { status: 401, statusText: 'Unauthorized' });
      await attendi();
      controller.expectOne(`${API}/api/Eventi/GetStati`).flush({}, { status: 401, statusText: 'Unauthorized' });

      await expect(risposta).rejects.toMatchObject({ status: 401 });
      expect(auth.rinnova).toHaveBeenCalledTimes(1);
    });

    it('passes the original 401 on when the renewal fails', async () => {
      auth.rinnova.mockResolvedValue(false);
      const risposta = firstValueFrom(http.get(`${API}/api/Eventi/GetStati`)).catch((err: unknown) => err);

      controller.expectOne(`${API}/api/Eventi/GetStati`).flush({}, { status: 401, statusText: 'Unauthorized' });
      await attendi();

      expect(await risposta).toMatchObject({ status: 401 });
      controller.expectNone(`${API}/api/Eventi/GetStati`);
    });

    it('does not try to renew when the user is no longer signed in', async () => {
      auth.autenticato = false;
      const risposta = firstValueFrom(http.get(`${API}/api/Eventi/GetStati`));

      controller.expectOne(`${API}/api/Eventi/GetStati`).flush({}, { status: 401, statusText: 'Unauthorized' });

      await expect(risposta).rejects.toMatchObject({ status: 401 });
      expect(auth.rinnova).not.toHaveBeenCalled();
    });

    it.each([403, 404, 500, 0])('passes an error %i on without renewing', async (status) => {
      const risposta = firstValueFrom(http.get(`${API}/api/Eventi/GetStati`));

      controller.expectOne(`${API}/api/Eventi/GetStati`).flush({}, { status, statusText: 'Error' });

      await expect(risposta).rejects.toMatchObject({ status });
      expect(auth.rinnova).not.toHaveBeenCalled();
    });
  });
});
