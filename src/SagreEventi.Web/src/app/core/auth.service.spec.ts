import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { ConfigService } from './config.service';

const API = 'https://api.test';
const STORAGE_KEY = 'sagreeventi.auth.v1';
const INIZIO = new Date('2026-06-10T10:00:00Z');

const token = (accessToken = 'access-1', refreshToken = 'refresh-1', expiresIn = 120) => ({ accessToken, refreshToken, expiresIn });

describe('AuthService', () => {
  let http: HttpTestingController;

  /** Creates the service after the storage has been prepared (the session is restored in the constructor). */
  const crea = (): AuthService => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigService, useValue: { apiBaseUrl: () => API } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  };

  /** Lets the pending promise callbacks run (real timers: only `Date` is faked), then returns what `leggi` finds. */
  const dopoRisposta = async <T>(leggi: () => T): Promise<T> => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    return leggi();
  };

  /** Runs a full login. The second request starts only after the first one has been answered. */
  const accedi = async (service: AuthService, risposta = token(), ruoli = ['Admin'], email = 'admin@example.com') => {
    const login = service.login(email, 'segreta');
    http.expectOne(`${API}/api/auth/login`).flush(risposta);
    const me = await dopoRisposta(() => http.expectOne(`${API}/api/auth/me`));
    me.flush({ email, ruoli });
    await login;
  };

  const sessioneSalvata = () => JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as Record<string, unknown> | null;

  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(INIZIO);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('anonymous user', () => {
    it('starts without session', () => {
      const service = crea();

      expect(service.autenticato()).toBe(false);
      expect(service.email()).toBeNull();
      expect(service.ruoli()).toEqual([]);
      expect(service.accessToken()).toBeNull();
      expect(service.inScadenza()).toBe(false);
    });
  });

  describe('login', () => {
    it('posts the credentials, then reads the user with the new token', async () => {
      const service = crea();

      const login = service.login('admin@example.com', 'segreta');
      const reqLogin = http.expectOne(`${API}/api/auth/login`);
      expect(reqLogin.request.method).toBe('POST');
      expect(reqLogin.request.body).toEqual({ email: 'admin@example.com', password: 'segreta' });
      reqLogin.flush(token('access-1', 'refresh-1', 120));

      const reqMe = await dopoRisposta(() => http.expectOne(`${API}/api/auth/me`));
      expect(reqMe.request.method).toBe('GET');
      expect(reqMe.request.headers.get('Authorization')).toBe('Bearer access-1');
      reqMe.flush({ email: 'admin@example.com', ruoli: ['Admin', 'Editor'] });
      await login;

      expect(service.autenticato()).toBe(true);
      expect(service.email()).toBe('admin@example.com');
      expect(service.ruoli()).toEqual(['Admin', 'Editor']);
      expect(service.accessToken()).toBe('access-1');
    });

    it('stores the session in sessionStorage (never in localStorage)', async () => {
      const service = crea();

      await accedi(service);

      expect(sessioneSalvata()).toEqual({
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        scadenza: INIZIO.getTime() + 120_000,
        email: 'admin@example.com',
        ruoli: ['Admin'],
      });
      expect(localStorage.length).toBe(0);
    });

    it('rejects and stays anonymous when the credentials are wrong', async () => {
      const service = crea();

      const login = service.login('admin@example.com', 'sbagliata');
      http.expectOne(`${API}/api/auth/login`).flush({}, { status: 401, statusText: 'Unauthorized' });

      await expect(login).rejects.toMatchObject({ status: 401 });
      expect(service.autenticato()).toBe(false);
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('stays anonymous when reading the user fails after a successful login', async () => {
      const service = crea();

      const login = service.login('admin@example.com', 'segreta');
      http.expectOne(`${API}/api/auth/login`).flush(token());
      const me = await dopoRisposta(() => http.expectOne(`${API}/api/auth/me`));
      me.flush({}, { status: 500, statusText: 'Server Error' });

      await expect(login).rejects.toMatchObject({ status: 500 });
      expect(service.autenticato()).toBe(false);
      expect(service.accessToken()).toBeNull();
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('keeps working in memory when sessionStorage cannot be written', async () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      });
      const service = crea();

      await accedi(service);

      expect(service.autenticato()).toBe(true);
    });
  });

  describe('logout', () => {
    it('clears the session and the storage', async () => {
      const service = crea();
      await accedi(service);

      service.logout();

      expect(service.autenticato()).toBe(false);
      expect(service.accessToken()).toBeNull();
      expect(service.ruoli()).toEqual([]);
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe('inScadenza', () => {
    it('is false while the token is valid beyond the 30 s margin, true from the margin on', async () => {
      const service = crea();
      await accedi(service, token('a', 'r', 120));

      expect(service.inScadenza()).toBe(false);

      vi.setSystemTime(INIZIO.getTime() + 89_999);
      expect(service.inScadenza()).toBe(false);

      vi.setSystemTime(INIZIO.getTime() + 90_000);
      expect(service.inScadenza()).toBe(true);

      vi.setSystemTime(INIZIO.getTime() + 500_000);
      expect(service.inScadenza()).toBe(true);
    });
  });

  describe('rinnova', () => {
    it('returns false without any request when there is no session', async () => {
      const service = crea();

      await expect(service.rinnova()).resolves.toBe(false);
    });

    it('exchanges the refresh token and keeps user and roles', async () => {
      const service = crea();
      await accedi(service);
      vi.setSystemTime(INIZIO.getTime() + 100_000);

      const esito = service.rinnova();
      const req = http.expectOne(`${API}/api/auth/refresh`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ refreshToken: 'refresh-1' });
      req.flush(token('access-2', 'refresh-2', 300));

      await expect(esito).resolves.toBe(true);
      expect(service.accessToken()).toBe('access-2');
      expect(service.email()).toBe('admin@example.com');
      expect(service.ruoli()).toEqual(['Admin']);
      expect(service.inScadenza()).toBe(false);
      expect(sessioneSalvata()).toMatchObject({
        accessToken: 'access-2',
        refreshToken: 'refresh-2',
        scadenza: INIZIO.getTime() + 100_000 + 300_000,
      });
    });

    it('shares one request between concurrent calls', async () => {
      const service = crea();
      await accedi(service);

      const a = service.rinnova();
      const b = service.rinnova();
      http.expectOne(`${API}/api/auth/refresh`).flush(token('access-2', 'refresh-2'));

      await expect(Promise.all([a, b])).resolves.toEqual([true, true]);
    });

    it('allows a new renewal once the previous one has finished', async () => {
      const service = crea();
      await accedi(service);

      const prima = service.rinnova();
      http.expectOne(`${API}/api/auth/refresh`).flush(token('access-2', 'refresh-2'));
      await prima;

      const seconda = service.rinnova();
      const req = http.expectOne(`${API}/api/auth/refresh`);
      expect(req.request.body).toEqual({ refreshToken: 'refresh-2' });
      req.flush(token('access-3', 'refresh-3'));
      await expect(seconda).resolves.toBe(true);
    });

    it('logs out and returns false when the refresh token is rejected', async () => {
      const service = crea();
      await accedi(service);

      const esito = service.rinnova();
      http.expectOne(`${API}/api/auth/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });

      await expect(esito).resolves.toBe(false);
      expect(service.autenticato()).toBe(false);
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe('aggiornaUtente', () => {
    it('does nothing for an anonymous user', async () => {
      const service = crea();

      await service.aggiornaUtente();
    });

    it('aligns email and roles with the server', async () => {
      const service = crea();
      await accedi(service, token(), ['Admin']);

      const aggiornamento = service.aggiornaUtente();
      const req = http.expectOne(`${API}/api/auth/me`);
      expect(req.request.method).toBe('GET');
      req.flush({ email: 'nuovo@example.com', ruoli: ['Editor'] });
      await aggiornamento;

      expect(service.email()).toBe('nuovo@example.com');
      expect(service.ruoli()).toEqual(['Editor']);
      expect(service.accessToken()).toBe('access-1');
      expect(sessioneSalvata()).toMatchObject({ email: 'nuovo@example.com', ruoli: ['Editor'] });
    });

    it('keeps the current session when the request fails', async () => {
      const service = crea();
      await accedi(service);

      const aggiornamento = service.aggiornaUtente();
      http.expectOne(`${API}/api/auth/me`).flush({}, { status: 500, statusText: 'Server Error' });
      await aggiornamento;

      expect(service.autenticato()).toBe(true);
      expect(service.ruoli()).toEqual(['Admin']);
    });
  });

  describe('session restore', () => {
    it('restores a valid saved session', () => {
      const salvata = { accessToken: 'a', refreshToken: 'r', scadenza: INIZIO.getTime() + 60_000, email: 'x@example.com', ruoli: ['Editor'] };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(salvata));

      const service = crea();

      expect(service.autenticato()).toBe(true);
      expect(service.email()).toBe('x@example.com');
      expect(service.ruoli()).toEqual(['Editor']);
      expect(service.accessToken()).toBe('a');
    });

    it('defaults email and roles when they are missing', () => {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ accessToken: 'a', refreshToken: 'r', scadenza: 1 }));

      const service = crea();

      expect(service.autenticato()).toBe(true);
      expect(service.email()).toBe('');
      expect(service.ruoli()).toEqual([]);
    });

    it.each([
      ['corrupted JSON', '{not json'],
      ['a JSON null', 'null'],
      ['a missing access token', JSON.stringify({ refreshToken: 'r', scadenza: 1 })],
      ['a missing refresh token', JSON.stringify({ accessToken: 'a', scadenza: 1 })],
      ['a non numeric expiry', JSON.stringify({ accessToken: 'a', refreshToken: 'r', scadenza: '2026' })],
      ['non string tokens', JSON.stringify({ accessToken: 1, refreshToken: {}, scadenza: 1 })],
    ])('starts anonymous with %s', (_nome, raw) => {
      sessionStorage.setItem(STORAGE_KEY, raw);

      const service = crea();

      expect(service.autenticato()).toBe(false);
      expect(service.accessToken()).toBeNull();
    });

    it('starts anonymous when sessionStorage cannot be read', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('Denied', 'SecurityError');
      });

      const service = crea();

      expect(service.autenticato()).toBe(false);
    });
  });
});
