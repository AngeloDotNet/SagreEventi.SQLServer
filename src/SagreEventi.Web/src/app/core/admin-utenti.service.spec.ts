import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AdminUtentiService, DatiUtente, messaggioErroreApi } from './admin-utenti.service';
import { ConfigService } from './config.service';

const API = 'https://api.test';
const BASE = `${API}/api/admin`;
const dati: DatiUtente = { email: 'nuovo@example.com', password: 'Password1!', ruoli: ['Editor'] };

describe('AdminUtentiService', () => {
  let service: AdminUtentiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigService, useValue: { apiBaseUrl: () => API } },
      ],
    });
    service = TestBed.inject(AdminUtentiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('ruoli reads the available roles', async () => {
    const chiamata = service.ruoli();
    const req = http.expectOne(`${BASE}/ruoli`);
    expect(req.request.method).toBe('GET');
    req.flush(['Admin', 'Editor']);

    await expect(chiamata).resolves.toEqual(['Admin', 'Editor']);
  });

  it('utenti reads the users', async () => {
    const chiamata = service.utenti();
    const req = http.expectOne(`${BASE}/utenti`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: '1', email: 'a@example.com', ruoli: [] }]);

    await expect(chiamata).resolves.toHaveLength(1);
  });

  it('crea posts the new user', async () => {
    const chiamata = service.crea(dati);
    const req = http.expectOne(`${BASE}/utenti`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dati);
    req.flush({ id: '1', email: dati.email, ruoli: dati.ruoli });

    await expect(chiamata).resolves.toMatchObject({ id: '1' });
  });

  it('modifica puts the user data on the user URL', async () => {
    const chiamata = service.modifica('42', dati);
    const req = http.expectOne(`${BASE}/utenti/42`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(dati);
    req.flush({ id: '42', email: dati.email, ruoli: dati.ruoli });

    await expect(chiamata).resolves.toMatchObject({ id: '42' });
  });

  it('elimina deletes the user', async () => {
    const chiamata = service.elimina('42');
    const req = http.expectOne(`${BASE}/utenti/42`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    await expect(chiamata).resolves.toBeNull();
  });

  it.each([
    ['../ruoli', '..%2Fruoli'],
    ['a/b?x=1#y', 'a%2Fb%3Fx%3D1%23y'],
    ['id con spazi', 'id%20con%20spazi'],
  ])('encodes the id "%s" so that it cannot change the path', async (id, codificato) => {
    const modifica = service.modifica(id, dati);
    http.expectOne(`${BASE}/utenti/${codificato}`).flush({});
    await modifica;

    const elimina = service.elimina(id);
    http.expectOne(`${BASE}/utenti/${codificato}`).flush(null);
    await elimina;
  });

  it('rejects with the server error', async () => {
    const chiamata = service.crea(dati);
    http.expectOne(`${BASE}/utenti`).flush({ title: 'Duplicato' }, { status: 409, statusText: 'Conflict' });

    await expect(chiamata).rejects.toMatchObject({ status: 409 });
  });
});

describe('messaggioErroreApi', () => {
  const predefinito = 'Operazione non riuscita.';
  const http = (status: number, error: unknown = null) => new HttpErrorResponse({ status, error });

  it.each([
    ['an Error', new Error('boom')],
    ['a string', 'boom'],
    ['null', null],
    ['undefined', undefined],
  ])('returns the default for %s (never the raw message)', (_nome, err) => {
    expect(messaggioErroreApi(err, predefinito)).toBe(predefinito);
  });

  it('says the server is unreachable for status 0', () => {
    expect(messaggioErroreApi(http(0), predefinito)).toBe('Server non raggiungibile.');
  });

  it.each([401, 403])('asks to sign in again as Admin for status %i', (status) => {
    expect(messaggioErroreApi(http(status), predefinito)).toContain('accedi di nuovo come Admin');
  });

  it('joins the validation errors of a ValidationProblem', () => {
    const err = http(400, { title: 'One or more validation errors occurred.', errors: { Email: ['Email non valida.'], Password: ['Troppo corta.', 'Serve una cifra.'] } });

    expect(messaggioErroreApi(err, predefinito)).toBe('Email non valida. Troppo corta. Serve una cifra.');
  });

  it('uses the title of a ProblemDetails', () => {
    expect(messaggioErroreApi(http(409, { title: 'Utente già esistente' }), predefinito)).toBe('Utente già esistente');
  });

  it('falls back to the title when the validation errors are empty', () => {
    expect(messaggioErroreApi(http(400, { title: 'Richiesta non valida', errors: {} }), predefinito)).toBe('Richiesta non valida');
  });

  it.each([
    ['an empty body', null],
    ['a plain text body', 'Internal Server Error: stack trace'],
    ['a body without title', {}],
  ])('returns the default for %s', (_nome, corpo) => {
    expect(messaggioErroreApi(http(500, corpo), predefinito)).toBe(predefinito);
  });
});
