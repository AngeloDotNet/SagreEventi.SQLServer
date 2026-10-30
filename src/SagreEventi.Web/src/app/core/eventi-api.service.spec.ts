import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ConfigService } from './config.service';
import { EventiApiService } from './eventi-api.service';
import { Evento } from './models';

const API = 'https://api.test';

describe('EventiApiService', () => {
  let service: EventiApiService;
  let http: HttpTestingController;

  const configura = (apiBaseUrl: string) => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigService, useValue: { apiBaseUrl: () => apiBaseUrl } },
      ],
    });
    service = TestBed.inject(EventiApiService);
    http = TestBed.inject(HttpTestingController);
  };

  beforeEach(() => configura(API));

  afterEach(() => http.verify());

  it('getEventi sends a GET with the cursor as query parameter', () => {
    let ricevuti: Evento[] = [];
    service.getEventi('2026-03-01T10:00:00Z').subscribe((e) => (ricevuti = e));

    const req = http.expectOne((r) => r.url === `${API}/api/Eventi/GetEventi`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('since')).toBe('2026-03-01T10:00:00Z');
    req.flush([{ id: 'a' }]);

    expect(ricevuti).toEqual([{ id: 'a' }] as Evento[]);
  });

  it('getEventi encodes a hostile cursor instead of altering the query', () => {
    service.getEventi('x&admin=true#frag').subscribe();

    const req = http.expectOne((r) => r.url === `${API}/api/Eventi/GetEventi`);
    // "&" and "#" are escaped, so the value stays a single parameter and cannot start a fragment ("=" inside a value is harmless)
    const query = req.request.urlWithParams.slice(req.request.urlWithParams.indexOf('?') + 1);
    expect(query).toBe('since=x%26admin=true%23frag');
    expect(query).not.toContain('&');
    expect(req.request.urlWithParams).not.toContain('#');
    req.flush([]);
  });

  it('getStati sends one "ids" parameter per id', () => {
    service.getStati(['a', 'b']).subscribe();

    const req = http.expectOne((r) => r.url === `${API}/api/Eventi/GetStati`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.getAll('ids')).toEqual(['a', 'b']);
    expect(req.request.urlWithParams).toBe(`${API}/api/Eventi/GetStati?ids=a&ids=b`);
    req.flush([]);
  });

  it('updateEventi puts the events as JSON and reads the answer as text', () => {
    const eventi = [{ id: 'a' }] as Evento[];
    let risposta = '';
    service.updateEventi(eventi).subscribe((r) => (risposta = r));

    const req = http.expectOne(`${API}/api/Eventi/UpdateEventi`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(eventi);
    expect(req.request.responseType).toBe('text');
    req.flush('Eventi aggiornati');

    expect(risposta).toBe('Eventi aggiornati');
  });

  it('uses a relative URL when the API base URL is empty (same origin)', () => {
    TestBed.resetTestingModule();
    configura('');

    service.updateEventi([]).subscribe();

    http.expectOne('/api/Eventi/UpdateEventi').flush('');
  });
});
