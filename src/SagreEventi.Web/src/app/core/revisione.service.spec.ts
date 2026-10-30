import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ConfigService } from './config.service';
import { Evento } from './models';
import { RevisioneService } from './revisione.service';

const API = 'https://api.test';
const BASE = `${API}/api/Eventi/Revisione`;
const eventi = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `e${i}` }) as Evento);

describe('RevisioneService', () => {
  let service: RevisioneService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigService, useValue: { apiBaseUrl: () => API } },
      ],
    });
    service = TestBed.inject(RevisioneService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Starts a call, answers the single request it makes and returns the settled result. */
  const rispondi = async <T>(chiamata: Promise<T>, url: string, corpo: object, opzioni?: { status: number; statusText: string }): Promise<T> => {
    http.expectOne((r) => r.url === url).flush(corpo, opzioni);
    return chiamata;
  };

  describe('daRivedere', () => {
    it('reads the pending reports and publishes their count', async () => {
      expect(service.inAttesa()).toBeNull();
      const chiamata = service.daRivedere('InAttesa');
      const req = http.expectOne((r) => r.url === `${BASE}/DaRivedere`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('stato')).toBe('InAttesa');
      req.flush(eventi(3));

      await expect(chiamata).resolves.toHaveLength(3);
      expect(service.inAttesa()).toBe(3);
    });

    it('does not touch the counter when reading the rejected ones', async () => {
      service.inAttesa.set(7);

      const chiamata = service.daRivedere('Rifiutato');
      const req = http.expectOne((r) => r.url === `${BASE}/DaRivedere`);
      expect(req.request.params.get('stato')).toBe('Rifiutato');
      req.flush(eventi(2));

      await expect(chiamata).resolves.toHaveLength(2);
      expect(service.inAttesa()).toBe(7);
    });

    it('rejects and leaves the counter as it is when the server fails', async () => {
      service.inAttesa.set(7);

      const esito = rispondi(service.daRivedere('InAttesa'), `${BASE}/DaRivedere`, {}, { status: 500, statusText: 'Server Error' });

      await expect(esito).rejects.toMatchObject({ status: 500 });
      expect(service.inAttesa()).toBe(7);
    });
  });

  describe('conclusi', () => {
    it('reads the concluded events', async () => {
      const chiamata = service.conclusi();
      const req = http.expectOne(`${BASE}/Conclusi`);
      expect(req.request.method).toBe('GET');
      req.flush(eventi(1));

      await expect(chiamata).resolves.toHaveLength(1);
    });

    it('rejects with the 403 an Editor receives', async () => {
      const chiamata = service.conclusi();
      http.expectOne(`${BASE}/Conclusi`).flush({}, { status: 403, statusText: 'Forbidden' });

      await expect(chiamata).rejects.toMatchObject({ status: 403 });
    });
  });

  describe('aggiornaConteggio', () => {
    it('refreshes the counter', async () => {
      const chiamata = service.aggiornaConteggio();
      http.expectOne((r) => r.url === `${BASE}/DaRivedere`).flush(eventi(4));
      await chiamata;

      expect(service.inAttesa()).toBe(4);
    });

    it('swallows the error and keeps the current value', async () => {
      service.inAttesa.set(2);

      const chiamata = service.aggiornaConteggio();
      http.expectOne((r) => r.url === `${BASE}/DaRivedere`).flush({}, { status: 401, statusText: 'Unauthorized' });

      await expect(chiamata).resolves.toBeUndefined();
      expect(service.inAttesa()).toBe(2);
    });
  });

  describe('approva / rifiuta', () => {
    it('approva posts the ids', async () => {
      const chiamata = service.approva(['a', 'b']);
      const req = http.expectOne(`${BASE}/Approva`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ ids: ['a', 'b'] });
      req.flush({ modificati: 2 });

      await expect(chiamata).resolves.toEqual({ modificati: 2 });
    });

    it('rifiuta posts the ids and the note', async () => {
      const chiamata = service.rifiuta(['a'], 'Duplicato');
      const req = http.expectOne(`${BASE}/Rifiuta`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ ids: ['a'], motivo: 'Duplicato' });
      req.flush({ modificati: 1 });

      await expect(chiamata).resolves.toEqual({ modificati: 1 });
    });

    it.each<[string | undefined]>([[''], [undefined]])('rifiuta sends a null note when it is %j', async (motivo) => {
      const chiamata = service.rifiuta(['a'], motivo);
      const req = http.expectOne(`${BASE}/Rifiuta`);
      expect(req.request.body).toEqual({ ids: ['a'], motivo: null });
      req.flush({ modificati: 1 });
      await chiamata;
    });

    it('rejects with the server error', async () => {
      const chiamata = service.approva(['a']);
      http.expectOne(`${BASE}/Approva`).flush({ title: 'Richiesta non valida' }, { status: 400, statusText: 'Bad Request' });

      await expect(chiamata).rejects.toMatchObject({ status: 400 });
    });
  });

  it('azzera resets the counter', () => {
    service.inAttesa.set(5);

    service.azzera();

    expect(service.inAttesa()).toBeNull();
  });
});
