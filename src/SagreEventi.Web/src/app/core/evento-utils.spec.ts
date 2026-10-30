import {
  confrontaPerInizio,
  durataGiorni,
  formatDataLunga,
  formatMeseAnno,
  formatPeriodo,
  giorniAllInizio,
  giorniTra,
  giornoMese,
  normalizzaTesto,
  nuovoId,
  parseLocalDate,
  parseUtc,
  startOfToday,
  statoEvento,
  statoLabel,
  statoSeverity,
  toApiPayload,
  toDateOnlyIso,
  visualEvento,
} from './evento-utils';
import { Evento, EventoLocale } from './models';

/** Builds an event with only the dates that matter for the test (local midnight, API format). */
const periodo = (inizio: string, fine: string) => ({
  dataInizioEvento: `${inizio}T00:00:00`,
  dataFineEvento: `${fine}T00:00:00`,
});

const evento = (parziale: Partial<Evento> = {}): Evento => ({
  id: 'e1',
  nomeEvento: 'Sagra',
  cittaEvento: 'Roma',
  ...periodo('2026-06-10', '2026-06-12'),
  descrizioneEvento: '',
  eventoConcluso: false,
  dataOraUltimaModifica: '2026-01-01T10:00:00Z',
  ...parziale,
});

describe('evento-utils', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('toDateOnlyIso / parseLocalDate', () => {
    it('round-trips a local date without timezone shifts', () => {
      expect(toDateOnlyIso(parseLocalDate('2026-03-15T00:00:00'))).toBe('2026-03-15T00:00:00');
    });

    it('pads month and day with zeros', () => {
      expect(toDateOnlyIso(new Date(2026, 0, 5))).toBe('2026-01-05T00:00:00');
    });

    it('ignores time and zone of the server string', () => {
      const d = parseLocalDate('2026-03-15T23:59:59+05:00');
      expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 2, 15, 0]);
    });

    it.each([null, undefined, '', 'not a date', '15/03/2026'])('returns an invalid date for %j', (value) => {
      expect(Number.isNaN(parseLocalDate(value).getTime())).toBe(true);
    });
  });

  describe('parseUtc', () => {
    it('treats a value without zone as UTC', () => {
      expect(parseUtc('2026-01-01T10:00:00')).toBe(Date.UTC(2026, 0, 1, 10));
    });

    it('honours Z and explicit offsets', () => {
      expect(parseUtc('2026-01-01T10:00:00Z')).toBe(Date.UTC(2026, 0, 1, 10));
      expect(parseUtc('2026-01-01T12:00:00+02:00')).toBe(Date.UTC(2026, 0, 1, 10));
    });

    it('truncates fractional seconds beyond milliseconds (SQL Server precision)', () => {
      expect(parseUtc('2026-01-01T10:00:00.1234567')).toBe(Date.UTC(2026, 0, 1, 10, 0, 0, 123));
    });

    it.each([null, undefined, '', 'garbage'])('returns 0 for %j', (value) => {
      expect(parseUtc(value)).toBe(0);
    });
  });

  describe('startOfToday / giorniTra', () => {
    it('returns local midnight of the current day', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 5, 10, 18, 30, 15));
      expect(startOfToday()).toEqual(new Date(2026, 5, 10));
    });

    it('counts whole days, also across a DST change', () => {
      expect(giorniTra(new Date(2026, 2, 28), new Date(2026, 2, 30))).toBe(2);
      expect(giorniTra(new Date(2026, 9, 24), new Date(2026, 9, 26))).toBe(2);
      expect(giorniTra(new Date(2026, 5, 10), new Date(2026, 5, 9))).toBe(-1);
    });
  });

  describe('statoEvento', () => {
    const oggi = new Date(2026, 5, 10);

    it('is "terminato" when the end date is in the past', () => {
      expect(statoEvento(periodo('2026-06-01', '2026-06-09'), oggi)).toBe('terminato');
    });

    it('is "in-corso" on the first and on the last day', () => {
      expect(statoEvento(periodo('2026-06-10', '2026-06-12'), oggi)).toBe('in-corso');
      expect(statoEvento(periodo('2026-06-08', '2026-06-10'), oggi)).toBe('in-corso');
    });

    it('is "in-arrivo" when it starts after today', () => {
      expect(statoEvento(periodo('2026-06-11', '2026-06-12'), oggi)).toBe('in-arrivo');
    });
  });

  describe('giorniAllInizio / statoLabel / statoSeverity', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 5, 10, 12));
    });

    it('computes days to the start', () => {
      expect(giorniAllInizio(periodo('2026-06-15', '2026-06-16'))).toBe(5);
      expect(giorniAllInizio(periodo('2026-06-10', '2026-06-16'))).toBe(0);
    });

    it.each([
      ['2026-06-01', '2026-06-09', 'Terminato', 'secondary'],
      ['2026-06-09', '2026-06-11', 'In corso', 'success'],
      ['2026-06-11', '2026-06-12', 'Da domani', 'warn'],
      ['2026-06-12', '2026-06-13', 'Fra 2 giorni', 'warn'],
      ['2026-06-24', '2026-06-25', 'Fra 14 giorni', 'warn'],
      ['2026-06-25', '2026-06-26', 'In programma', 'warn'],
    ])('%s → %s is labelled "%s" with severity %s', (inizio, fine, label, severity) => {
      const e = periodo(inizio, fine);
      expect(statoLabel(e)).toBe(label);
      expect(statoSeverity(e)).toBe(severity);
    });
  });

  describe('formatting', () => {
    it('formats a single day with day, short month and year', () => {
      expect(formatPeriodo(periodo('2026-06-10', '2026-06-10'))).toMatch(/^10 giu 2026$/);
    });

    it('collapses the month when start and end are in the same month', () => {
      expect(formatPeriodo(periodo('2026-06-10', '2026-06-12'))).toBe('10–12 giu 2026');
    });

    it('keeps both months when the year is the same', () => {
      expect(formatPeriodo(periodo('2026-06-28', '2026-07-02'))).toBe('28 giu – 2 lug 2026');
    });

    it('keeps both complete dates across years', () => {
      expect(formatPeriodo(periodo('2026-12-30', '2027-01-02'))).toBe('30 dic 2026 – 2 gen 2027');
    });

    it('returns an empty string when a date is not valid', () => {
      expect(formatPeriodo({ dataInizioEvento: 'x', dataFineEvento: '2026-06-12T00:00:00' })).toBe('');
      expect(formatPeriodo({ dataInizioEvento: '2026-06-12T00:00:00', dataFineEvento: '' })).toBe('');
    });

    it('formats long date, month/year and day/month parts in Italian', () => {
      expect(formatDataLunga('2026-06-10T00:00:00')).toBe('mercoledì 10 giugno 2026');
      expect(formatMeseAnno(new Date(2026, 5, 1))).toBe('giugno 2026');
      expect(giornoMese('2026-06-10T00:00:00')).toEqual({ giorno: '10', mese: 'giu' });
    });

    it('counts the duration inclusive of both days', () => {
      expect(durataGiorni(periodo('2026-06-10', '2026-06-10'))).toBe(1);
      expect(durataGiorni(periodo('2026-06-10', '2026-06-12'))).toBe(3);
    });
  });

  describe('normalizzaTesto', () => {
    it('lowercases and strips accents', () => {
      expect(normalizzaTesto('Perugia – Città di Castello è BELLA')).toBe('perugia – citta di castello e bella');
    });
  });

  describe('confrontaPerInizio', () => {
    it('sorts events by start date ascending', () => {
      const tardi = evento({ id: 'b', ...periodo('2026-07-01', '2026-07-02') });
      const presto = evento({ id: 'a', ...periodo('2026-06-01', '2026-06-02') });
      expect([tardi, presto].sort(confrontaPerInizio).map((e) => e.id)).toEqual(['a', 'b']);
    });
  });

  describe('toApiPayload', () => {
    it('drops local-only fields and keeps the contract fields', () => {
      const locale: EventoLocale = { ...evento({ stato: 'InAttesa', motivoRifiuto: 'no' }), dirty: true, protetta: true, mio: true };
      const payload = toApiPayload(locale);
      expect(Object.keys(payload).sort()).toEqual(
        [
          'cittaEvento',
          'dataFineEvento',
          'dataInizioEvento',
          'dataOraUltimaModifica',
          'descrizioneEvento',
          'eventoConcluso',
          'id',
          'nomeEvento',
        ].sort(),
      );
      expect(payload.nomeEvento).toBe('Sagra');
    });
  });

  describe('nuovoId', () => {
    const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

    it('uses crypto.randomUUID when available', () => {
      vi.stubGlobal('crypto', { randomUUID: () => 'fixed-uuid' });
      expect(nuovoId()).toBe('fixed-uuid');
    });

    it('falls back to a v4 UUID built from getRandomValues', () => {
      vi.stubGlobal('crypto', {
        getRandomValues: (b: Uint8Array) => {
          b.fill(0xff);
          return b;
        },
      });
      const id = nuovoId();
      expect(id).toMatch(uuidV4);
    });

    it('generates distinct ids', () => {
      expect(nuovoId()).not.toBe(nuovoId());
      expect(nuovoId()).toMatch(uuidV4);
    });
  });

  describe('visualEvento', () => {
    it.each([
      ['Festa del vino novello', '🍷'],
      ['Sagra della birra', '🍺'],
      ['Sagra della Pizza', '🍕'],
      ['Fiera del tartufo', '🍄'],
      ['Sagra della castagna', '🌰'],
      ['Festa dell’olio', '🫒'],
      ['Sagra del pesce', '🐟'],
      ['Sagra della porchetta', '🥩'],
    ])('picks the motif of "%s"', (nomeEvento, emoji) => {
      expect(visualEvento({ id: 'x', nomeEvento, descrizioneEvento: '' }).emoji).toBe(emoji);
    });

    it('ignores accents and case when matching', () => {
      expect(visualEvento({ id: 'x', nomeEvento: 'SAGRA DEL CIOCCOLATO', descrizioneEvento: '' }).emoji).toBe('🍫');
    });

    it('gives precedence to the name over the description', () => {
      const v = visualEvento({ id: 'x', nomeEvento: 'Sagra della birra', descrizioneEvento: 'con vino e pizza' });
      expect(v.emoji).toBe('🍺');
    });

    it('falls back to the description when the name has no keyword', () => {
      expect(visualEvento({ id: 'x', nomeEvento: 'Grande sagra', descrizioneEvento: 'tanta pizza' }).emoji).toBe('🍕');
    });

    it('does not match a keyword inside a longer word', () => {
      const v = visualEvento({ id: 'q', nomeEvento: 'Marinella', descrizioneEvento: '' });
      expect(v.emoji).not.toBe('🐟');
    });

    it('uses a stable fallback for the same id and always a gradient', () => {
      const a = visualEvento({ id: 'id-1', nomeEvento: 'Qualcosa', descrizioneEvento: '' });
      const b = visualEvento({ id: 'id-1', nomeEvento: 'Altro nome', descrizioneEvento: '' });
      expect(a).toEqual(b);
      expect(a.gradient).toMatch(/^linear-gradient\(/);
    });

    it('handles an empty id by hashing the name', () => {
      const v = visualEvento({ id: '', nomeEvento: 'Qualcosa', descrizioneEvento: '' });
      expect(v.emoji).toBeTruthy();
    });
  });
});
