import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import type { Mock } from 'vitest';
import { EventiApiService } from './eventi-api.service';
import { EventiStore } from './eventi-store.service';
import { Evento, EventoDraft, EventoLocale, StatoModerazione } from './models';
import { PermessiService } from './permessi.service';

const STORAGE_KEY = 'sagreeventi.store.v1';
const SINCE_INIZIALE = '2020-01-01T00:00:00';
const ADESSO = new Date('2026-06-10T10:00:00.000Z');

interface FakeApi {
  getEventi: Mock<(since: string) => Observable<Evento[]>>;
  getStati: Mock<(ids: string[]) => Observable<{ id: string; stato: StatoModerazione }[]>>;
  updateEventi: Mock<(eventi: Evento[]) => Observable<string>>;
}

/** An event as stored locally; `stato` is "Approvato" unless the test says otherwise. */
const ev = (id: string, parziale: Partial<EventoLocale> = {}): EventoLocale => ({
  id,
  nomeEvento: `Evento ${id}`,
  cittaEvento: 'Roma',
  dataInizioEvento: '2026-06-10T00:00:00',
  dataFineEvento: '2026-06-12T00:00:00',
  descrizioneEvento: '',
  eventoConcluso: false,
  dataOraUltimaModifica: '2026-01-01T10:00:00Z',
  stato: 'Approvato',
  ...parziale,
});

const draft = (parziale: Partial<EventoDraft> = {}): EventoDraft => ({
  nomeEvento: 'Nuova sagra',
  cittaEvento: 'Viterbo',
  dataInizioEvento: '2026-07-01T00:00:00',
  dataFineEvento: '2026-07-02T00:00:00',
  descrizioneEvento: 'Descrizione',
  ...parziale,
});

describe('EventiStore', () => {
  let api: FakeApi;
  let puoModificare: Mock<() => boolean>;

  /** Saves a snapshot in localStorage as a previous session would have done. */
  const seed = (eventi: unknown[], extra: Record<string, unknown> = {}) =>
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, eventi, cursore: null, ultimaSincronizzazione: null, ...extra }));

  /** The snapshot the store has persisted (flushes the persistence effect first). */
  const snapshot = () => {
    TestBed.tick();
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as { version: number; eventi: EventoLocale[]; cursore: string | null; ultimaSincronizzazione: string | null };
  };

  /** Creates the store; the snapshot in localStorage is read in the constructor, so seed first. */
  const crea = (): EventiStore => TestBed.inject(EventiStore);

  const errore = (status: number) => throwError(() => new HttpErrorResponse({ status }));

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(ADESSO);

    api = {
      getEventi: vi.fn(() => of([])),
      getStati: vi.fn(() => of([])),
      updateEventi: vi.fn(() => of('ok')),
    };
    puoModificare = vi.fn(() => false);
    TestBed.configureTestingModule({
      providers: [
        { provide: EventiApiService, useValue: api },
        { provide: PermessiService, useValue: { puoModificare: () => puoModificare() } },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('persistence', () => {
    it('starts empty without a snapshot', () => {
      const store = crea();

      expect(store.eventi()).toEqual([]);
      expect(store.ultimaSincronizzazione()).toBeNull();
    });

    it('loads events, cursor and last sync from the snapshot', async () => {
      seed([ev('a')], { cursore: '2026-03-01T00:00:00Z', ultimaSincronizzazione: '2026-03-02T00:00:00Z' });

      const store = crea();

      expect(store.eventi().map((e) => e.id)).toEqual(['a']);
      expect(store.ultimaSincronizzazione()).toBe('2026-03-02T00:00:00Z');
      await store.sincronizza();
      expect(api.getEventi).toHaveBeenCalledWith('2026-03-01T00:00:00Z');
    });

    it('skips malformed entries of the snapshot', () => {
      seed([ev('a'), null, 'testo', { nomeEvento: 'senza id' }, { id: 5 }, ev('b')]);

      const store = crea();

      expect(store.eventi().map((e) => e.id)).toEqual(['a', 'b']);
    });

    it.each([
      ['corrupted JSON', '{non json'],
      ['a JSON null', 'null'],
      ['events that are not an array', JSON.stringify({ version: 1, eventi: { a: 1 } })],
    ])('starts empty with %s', (_nome, raw) => {
      localStorage.setItem(STORAGE_KEY, raw);

      const store = crea();

      expect(store.eventi()).toEqual([]);
    });

    it('ignores cursor and last sync of the wrong type', async () => {
      seed([], { cursore: 42, ultimaSincronizzazione: { x: 1 } });

      const store = crea();
      await store.sincronizza();

      expect(store.ultimaSincronizzazione()).not.toBe(42);
      expect(api.getEventi).toHaveBeenCalledWith(SINCE_INIZIALE);
    });

    it('persists every change as a versioned snapshot', () => {
      const store = crea();

      const evento = store.crea(draft());

      const salvato = snapshot();
      expect(salvato.version).toBe(1);
      expect(salvato.eventi.map((e) => e.id)).toEqual([evento.id]);
    });

    it('keeps working in memory when the storage is full or unavailable', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      });
      const store = crea();

      expect(() => {
        store.crea(draft());
        TestBed.tick();
      }).not.toThrow();
      expect(store.daInviare()).toBe(1);
    });

    it('starts empty when the storage cannot be read', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('Denied', 'SecurityError');
      });

      expect(crea().eventi()).toEqual([]);
    });
  });

  describe('crea', () => {
    it('creates a pending report for a user who cannot edit', () => {
      const store = crea();

      const evento = store.crea(draft());

      expect(evento).toMatchObject({
        ...draft(),
        eventoConcluso: false,
        dirty: true,
        mio: true,
        stato: 'InAttesa',
        dataOraUltimaModifica: ADESSO.toISOString(),
      });
      expect(evento.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(store.eventi()).toEqual([]);
      expect(store.mieSegnalazioni().map((e) => e.id)).toEqual([evento.id]);
      expect(store.daInviare()).toBe(1);
    });

    it('publishes right away (preview) for a user who can edit', () => {
      puoModificare.mockReturnValue(true);
      const store = crea();

      const evento = store.crea(draft());

      expect(evento.stato).toBe('Approvato');
      expect(store.eventi().map((e) => e.id)).toEqual([evento.id]);
      expect(store.mieSegnalazioni()).toEqual([]);
    });

    it('gives each event a different id', () => {
      const store = crea();

      expect(store.crea(draft()).id).not.toBe(store.crea(draft()).id);
    });
  });

  describe('aggiorna', () => {
    it('does nothing without the edit permission', () => {
      seed([ev('a')]);
      const store = crea();

      store.aggiorna('a', draft({ nomeEvento: 'Cambiato' }));

      expect(store.trova('a')?.nomeEvento).toBe('Evento a');
      expect(store.daInviare()).toBe(0);
    });

    it('updates the fields and marks the event as a protected change to send', () => {
      puoModificare.mockReturnValue(true);
      seed([ev('a')]);
      const store = crea();

      store.aggiorna('a', draft({ nomeEvento: 'Cambiato' }));

      expect(store.trova('a')).toMatchObject({ nomeEvento: 'Cambiato', cittaEvento: 'Viterbo', dirty: true, protetta: true });
      expect(store.trova('a')?.dataOraUltimaModifica).toBe(ADESSO.toISOString());
      expect(store.daInviare()).toBe(1);
    });

    it('ignores an unknown id', () => {
      puoModificare.mockReturnValue(true);
      seed([ev('a')]);
      const store = crea();

      store.aggiorna('zzz', draft());

      expect(store.daInviare()).toBe(0);
      expect(store.trova('zzz')).toBeUndefined();
    });
  });

  describe('selectors', () => {
    it('trova finds an event by id, but not a concluded one', () => {
      seed([ev('a'), ev('b', { eventoConcluso: true })]);
      const store = crea();

      expect(store.trova('a')?.id).toBe('a');
      expect(store.trova('b')).toBeUndefined();
      expect(store.trova('zzz')).toBeUndefined();
    });

    it('eventi lists approved, open events by start date; events without stato count as public', () => {
      seed([
        ev('tardi', { dataInizioEvento: '2026-08-01T00:00:00' }),
        ev('presto', { dataInizioEvento: '2026-06-01T00:00:00' }),
        ev('vecchio', { stato: undefined, dataInizioEvento: '2026-07-01T00:00:00' }),
        ev('attesa', { stato: 'InAttesa' }),
        ev('rifiutato', { stato: 'Rifiutato' }),
        ev('concluso', { eventoConcluso: true }),
      ]);
      const store = crea();

      expect(store.eventi().map((e) => e.id)).toEqual(['presto', 'vecchio', 'tardi']);
    });

    it('mieSegnalazioni lists my open reports that are not public yet, rejected ones included', () => {
      seed([
        ev('b', { mio: true, stato: 'InAttesa', dataInizioEvento: '2026-08-01T00:00:00' }),
        ev('a', { mio: true, stato: 'Rifiutato', dataInizioEvento: '2026-07-01T00:00:00' }),
        ev('approvato', { mio: true }),
        ev('altrui', { stato: 'InAttesa' }),
        ev('concluso', { mio: true, stato: 'InAttesa', eventoConcluso: true }),
      ]);
      const store = crea();

      expect(store.mieSegnalazioni().map((e) => e.id)).toEqual(['a', 'b']);
    });

    it('daInviare counts the events changed locally', () => {
      seed([ev('a', { dirty: true }), ev('b', { dirty: true }), ev('c')]);

      expect(crea().daInviare()).toBe(2);
    });

    it('citta lists the distinct trimmed cities of the public events, sorted', () => {
      seed([
        ev('1', { cittaEvento: '  Roma ' }),
        ev('2', { cittaEvento: 'Roma' }),
        ev('3', { cittaEvento: 'Ancona' }),
        ev('4', { cittaEvento: '   ' }),
        ev('5', { cittaEvento: 'Torino', stato: 'InAttesa' }),
        ev('6', { cittaEvento: 'Bari', eventoConcluso: true }),
      ]);

      expect(crea().citta()).toEqual(['Ancona', 'Roma']);
    });
  });

  describe('sincronizza: push', () => {
    it('sends the changed events without local-only fields, then clears the flags', async () => {
      seed([ev('a', { dirty: true, mio: true, stato: 'InAttesa' }), ev('b')]);
      const store = crea();

      await expect(store.sincronizza()).resolves.toBe(true);

      expect(api.updateEventi).toHaveBeenCalledTimes(1);
      const inviati = api.updateEventi.mock.calls[0][0];
      expect(inviati.map((e) => e.id)).toEqual(['a']);
      expect(Object.keys(inviati[0]).sort()).toEqual(
        ['cittaEvento', 'dataFineEvento', 'dataInizioEvento', 'dataOraUltimaModifica', 'descrizioneEvento', 'eventoConcluso', 'id', 'nomeEvento'],
      );
      expect(store.daInviare()).toBe(0);
    });

    it('does not call the server to push when nothing changed', async () => {
      seed([ev('a')]);

      await crea().sincronizza();

      expect(api.updateEventi).not.toHaveBeenCalled();
    });

    it('splits the push in requests of at most 20 events', async () => {
      seed(Array.from({ length: 45 }, (_, i) => ev(`e${i}`, { dirty: true })));
      const store = crea();

      await store.sincronizza();

      expect(api.updateEventi.mock.calls.map((c) => c[0].length)).toEqual([20, 20, 5]);
      expect(store.daInviare()).toBe(0);
    });

    it('keeps an event dirty when it was edited while the push was in flight', async () => {
      puoModificare.mockReturnValue(true);
      seed([ev('a', { dirty: true })]);
      const invio = new Subject<string>();
      api.updateEventi.mockReturnValue(invio);
      const store = crea();

      const esito = store.sincronizza();
      vi.setSystemTime(new Date(ADESSO.getTime() + 5_000));
      store.aggiorna('a', draft({ nomeEvento: 'Modificato durante l\'invio' }));
      invio.next('ok');
      invio.complete();
      await esito;

      expect(store.trova('a')).toMatchObject({ nomeEvento: 'Modificato durante l\'invio', dirty: true });
    });

    it('holds back protected changes without the role (the server would ignore them)', async () => {
      seed([ev('a', { dirty: true, protetta: true }), ev('b', { dirty: true })]);
      const store = crea();

      await store.sincronizza();

      expect(api.updateEventi.mock.calls[0][0].map((e) => e.id)).toEqual(['b']);
      expect(store.daInviare()).toBe(1);
      expect(store.trova('a')).toMatchObject({ dirty: true, protetta: true });
    });

    it('sends protected changes when the user has the role', async () => {
      puoModificare.mockReturnValue(true);
      seed([ev('a', { dirty: true, protetta: true })]);
      const store = crea();

      await store.sincronizza();

      expect(api.updateEventi.mock.calls[0][0].map((e) => e.id)).toEqual(['a']);
      expect(store.trova('a')).toMatchObject({ dirty: false, protetta: false });
    });

    it('drops concluded events once they have been sent', async () => {
      seed([ev('a', { dirty: true, eventoConcluso: true })]);
      const store = crea();

      await store.sincronizza();

      expect(snapshot().eventi).toEqual([]);
    });

    it('keeps the changes when the push fails', async () => {
      seed([ev('a', { dirty: true })]);
      api.updateEventi.mockReturnValue(errore(500));
      const store = crea();

      await expect(store.sincronizza()).resolves.toBe(false);

      expect(store.daInviare()).toBe(1);
      expect(api.getEventi).not.toHaveBeenCalled();
    });
  });

  describe('sincronizza: pull', () => {
    it('starts from the initial cursor, then asks only for what is newer', async () => {
      const store = crea();
      api.getEventi.mockReturnValueOnce(of([ev('a', { dataOraUltimaModifica: '2026-02-01T10:00:00Z' }), ev('b', { dataOraUltimaModifica: '2026-03-01T10:00:00Z' })]));

      await store.sincronizza();
      await store.sincronizza();

      expect(api.getEventi.mock.calls.map((c) => c[0])).toEqual([SINCE_INIZIALE, '2026-03-01T10:00:00Z']);
      expect(snapshot().cursore).toBe('2026-03-01T10:00:00Z');
    });

    it('records the time of the last successful sync', async () => {
      const store = crea();

      await store.sincronizza();

      expect(store.ultimaSincronizzazione()).toBe(ADESSO.toISOString());
      expect(snapshot().ultimaSincronizzazione).toBe(ADESSO.toISOString());
    });

    it('adds new remote events, normalising missing text and dropping server-only fields', async () => {
      api.getEventi.mockReturnValue(
        of([{ ...ev('a'), nomeEvento: null, cittaEvento: null, descrizioneEvento: null, motivoRifiuto: 'segreto' } as unknown as Evento]),
      );
      const store = crea();

      await store.sincronizza();

      const locale = store.trova('a');
      expect(locale).toMatchObject({ nomeEvento: '', cittaEvento: '', descrizioneEvento: '', dirty: false });
      expect(locale).not.toHaveProperty('motivoRifiuto');
    });

    it('treats a null response as no changes', async () => {
      seed([ev('a')]);
      api.getEventi.mockReturnValue(of(null as unknown as Evento[]));
      const store = crea();

      await expect(store.sincronizza()).resolves.toBe(true);

      expect(store.eventi().map((e) => e.id)).toEqual(['a']);
    });

    it('removes the events the server reports as concluded', async () => {
      seed([ev('a'), ev('b')]);
      api.getEventi.mockReturnValue(of([ev('a', { eventoConcluso: true, dataOraUltimaModifica: '2026-02-01T10:00:00Z' })]));
      const store = crea();

      await store.sincronizza();

      expect(store.eventi().map((e) => e.id)).toEqual(['b']);
      expect(snapshot().eventi.map((e) => e.id)).toEqual(['b']);
    });

    it('replaces a clean local event and keeps its "mio" flag', async () => {
      seed([ev('a', { mio: true, stato: 'InAttesa', nomeEvento: 'Vecchio' })]);
      api.getEventi.mockReturnValue(of([ev('a', { nomeEvento: 'Nuovo', stato: 'Approvato', dataOraUltimaModifica: '2026-02-01T10:00:00Z' })]));
      const store = crea();

      await store.sincronizza();

      expect(store.trova('a')).toMatchObject({ nomeEvento: 'Nuovo', stato: 'Approvato', mio: true });
    });

    it('keeps a local edit that is newer than the remote version', async () => {
      seed([ev('a', { dirty: true, protetta: true, nomeEvento: 'Locale', dataOraUltimaModifica: '2026-05-01T10:00:00Z' })]);
      api.getEventi.mockReturnValue(of([ev('a', { nomeEvento: 'Remoto', dataOraUltimaModifica: '2026-04-01T10:00:00Z' })]));
      const store = crea();

      await store.sincronizza();

      expect(store.trova('a')).toMatchObject({ nomeEvento: 'Locale', dirty: true });
    });

    it.each(['2026-05-01T10:00:00Z', '2026-06-01T10:00:00Z'])('lets the remote version win when it is as new or newer (%s)', async (remoto) => {
      seed([ev('a', { dirty: true, protetta: true, nomeEvento: 'Locale', dataOraUltimaModifica: '2026-05-01T10:00:00Z' })]);
      api.getEventi.mockReturnValue(of([ev('a', { nomeEvento: 'Remoto', dataOraUltimaModifica: remoto })]));
      const store = crea();

      await store.sincronizza();

      expect(store.trova('a')).toMatchObject({ nomeEvento: 'Remoto', dirty: false });
    });

    it('compares server timestamps without zone as UTC', async () => {
      seed([ev('a', { dirty: true, protetta: true, nomeEvento: 'Locale', dataOraUltimaModifica: '2026-05-01T10:00:00Z' })]);
      api.getEventi.mockReturnValue(of([ev('a', { nomeEvento: 'Remoto', dataOraUltimaModifica: '2026-05-01T09:59:59.1234567' })]));
      const store = crea();

      await store.sincronizza();

      expect(store.trova('a')?.nomeEvento).toBe('Locale');
    });

    it('never moves the cursor backwards', async () => {
      seed([], { cursore: '2026-03-01T00:00:00Z' });
      api.getEventi.mockReturnValue(of([ev('a', { dataOraUltimaModifica: '2026-02-01T00:00:00Z' })]));
      const store = crea();

      await store.sincronizza();

      expect(snapshot().cursore).toBe('2026-03-01T00:00:00Z');
    });
  });

  describe('sincronizza: outcome of my reports', () => {
    it('asks the server about my reports not yet public, and updates their state', async () => {
      seed([
        ev('mia', { mio: true, stato: 'InAttesa' }),
        ev('altrui', { stato: 'InAttesa' }),
        ev('approvata', { mio: true }),
      ]);
      api.getStati.mockReturnValue(of([{ id: 'mia', stato: 'Approvato' }]));
      const store = crea();

      await store.sincronizza();

      expect(api.getStati).toHaveBeenCalledWith(['mia']);
      expect(store.trova('mia')?.stato).toBe('Approvato');
      expect(store.eventi().map((e) => e.id)).toContain('mia');
      expect(store.trova('altrui')?.stato).toBe('InAttesa');
    });

    it('does not call the server when there is nothing to check', async () => {
      seed([ev('a')]);

      await crea().sincronizza();

      expect(api.getStati).not.toHaveBeenCalled();
    });

    it('does not check the reports whose changes are still waiting to be sent', async () => {
      seed([ev('mia', { mio: true, stato: 'InAttesa', dirty: true, protetta: true })]);

      await crea().sincronizza();

      expect(api.getStati).not.toHaveBeenCalled();
    });

    it('asks in requests of at most 50 ids', async () => {
      seed(Array.from({ length: 120 }, (_, i) => ev(`m${i}`, { mio: true, stato: 'InAttesa' })));

      await crea().sincronizza();

      expect(api.getStati.mock.calls.map((c) => c[0].length)).toEqual([50, 50, 20]);
    });

    it('ignores the outcome of events that are not mine', async () => {
      seed([ev('mia', { mio: true, stato: 'InAttesa' }), ev('altrui', { stato: 'InAttesa' })]);
      api.getStati.mockReturnValue(of([{ id: 'altrui', stato: 'Approvato' }]));
      const store = crea();

      await store.sincronizza();

      expect(store.trova('altrui')?.stato).toBe('InAttesa');
      expect(store.trova('mia')?.stato).toBe('InAttesa');
    });

    it('does not fail the synchronisation when the check fails, and tries again next time', async () => {
      seed([ev('mia', { mio: true, stato: 'InAttesa' })]);
      api.getStati.mockReturnValueOnce(errore(500));
      const store = crea();

      await expect(store.sincronizza()).resolves.toBe(true);
      expect(store.erroreSync()).toBeNull();
      expect(store.trova('mia')?.stato).toBe('InAttesa');

      api.getStati.mockReturnValueOnce(of([{ id: 'mia', stato: 'Approvato' }]));
      await store.sincronizza();
      expect(store.trova('mia')?.stato).toBe('Approvato');
    });
  });

  describe('sincronizza: errors and concurrency', () => {
    it.each([
      [0, 'Il server non risponde'],
      [500, 'errore 500'],
      [401, 'errore 401'],
    ])('reports a friendly message for an HTTP status %i, without leaking details', async (status, atteso) => {
      api.getEventi.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status, error: 'System.Exception: stack trace at Foo.Bar', url: 'https://interno/api' })),
      );
      const store = crea();

      await expect(store.sincronizza()).resolves.toBe(false);

      expect(store.erroreSync()).toContain(atteso);
      expect(store.erroreSync()).not.toContain('stack trace');
      expect(store.erroreSync()).not.toContain('interno');
      expect(store.sincronizzando()).toBe(false);
      expect(store.ultimaSincronizzazione()).toBeNull();
    });

    it('reports a generic message for an unexpected error', async () => {
      api.getEventi.mockReturnValue(throwError(() => new Error('boom')));
      const store = crea();

      await store.sincronizza();

      expect(store.erroreSync()).toBe('Sincronizzazione non riuscita.');
    });

    it('clears the error at the next successful synchronisation', async () => {
      api.getEventi.mockReturnValueOnce(errore(0));
      const store = crea();
      await store.sincronizza();
      expect(store.erroreSync()).not.toBeNull();

      await expect(store.sincronizza()).resolves.toBe(true);

      expect(store.erroreSync()).toBeNull();
    });

    it('refuses to start a second synchronisation while one is running', async () => {
      const risposta = new Subject<Evento[]>();
      api.getEventi.mockReturnValue(risposta);
      const store = crea();

      const prima = store.sincronizza();
      expect(store.sincronizzando()).toBe(true);
      await expect(store.sincronizza()).resolves.toBe(false);
      risposta.next([]);
      risposta.complete();

      await expect(prima).resolves.toBe(true);
      expect(api.getEventi).toHaveBeenCalledTimes(1);
      expect(store.sincronizzando()).toBe(false);
    });
  });

  describe('connectivity', () => {
    it('follows the online and offline events, and synchronises when the connection returns', async () => {
      const store = crea();

      window.dispatchEvent(new Event('offline'));
      expect(store.online()).toBe(false);

      window.dispatchEvent(new Event('online'));
      expect(store.online()).toBe(true);
      await vi.waitFor(() => expect(api.getEventi).toHaveBeenCalled());
    });
  });
});
