import { buildIcs, nomeFileSicuro, scaricaFile } from './ics';
import { Evento } from './models';

const evento = (parziale: Partial<Evento> = {}): Evento => ({
  id: 'abc-123',
  nomeEvento: 'Sagra della porchetta',
  cittaEvento: 'Ariccia',
  dataInizioEvento: '2026-06-10T00:00:00',
  dataFineEvento: '2026-06-12T00:00:00',
  descrizioneEvento: 'Tre giorni di festa',
  eventoConcluso: false,
  dataOraUltimaModifica: '2026-01-01T10:00:00Z',
  ...parziale,
});

/** Returns the value of the first property line starting with `nome`. */
const riga = (ics: string, nome: string): string | undefined => ics.split('\r\n').find((l) => l.startsWith(nome));

describe('ics', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  describe('buildIcs', () => {
    it('builds a VCALENDAR with one all-day VEVENT, separated by CRLF', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-01T08:30:15.123Z'));

      const ics = buildIcs(evento());

      expect(ics.split('\r\n')).toEqual([
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//SagreEventi//IT',
        'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        'UID:abc-123@sagreeventi',
        'DTSTAMP:20260501T083015Z',
        'DTSTART;VALUE=DATE:20260610',
        'DTEND;VALUE=DATE:20260613',
        'SUMMARY:Sagra della porchetta',
        'LOCATION:Ariccia',
        'DESCRIPTION:Tre giorni di festa',
        'END:VEVENT',
        'END:VCALENDAR',
      ]);
    });

    it('makes DTEND exclusive, also across a month and a year boundary', () => {
      const mese = buildIcs(evento({ dataInizioEvento: '2026-06-29T00:00:00', dataFineEvento: '2026-06-30T00:00:00' }));
      expect(riga(mese, 'DTEND')).toBe('DTEND;VALUE=DATE:20260701');

      const anno = buildIcs(evento({ dataInizioEvento: '2026-12-30T00:00:00', dataFineEvento: '2026-12-31T00:00:00' }));
      expect(riga(anno, 'DTEND')).toBe('DTEND;VALUE=DATE:20270101');
    });

    it('escapes backslash, comma, semicolon and newlines (RFC 5545)', () => {
      const ics = buildIcs(evento({ nomeEvento: 'a\\b, c; d', descrizioneEvento: 'riga1\nriga2\r\nriga3' }));

      expect(riga(ics, 'SUMMARY')).toBe('SUMMARY:a\\\\b\\, c\\; d');
      expect(riga(ics, 'DESCRIPTION')).toBe('DESCRIPTION:riga1\\nriga2\\nriga3');
    });

    it('cannot be used to inject extra properties or components through newlines', () => {
      const ics = buildIcs(
        evento({
          nomeEvento: 'x\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nATTENDEE:mailto:evil@example.com',
          cittaEvento: 'y\nORGANIZER:mailto:evil@example.com',
          descrizioneEvento: 'z\rX-EVIL:1',
        }),
      );

      const righe = ics.split('\r\n');
      expect(righe.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
      expect(righe.filter((l) => l === 'END:VEVENT')).toHaveLength(1);
      expect(righe.some((l) => l.startsWith('ATTENDEE') || l.startsWith('ORGANIZER') || l.startsWith('X-EVIL'))).toBe(false);
    });

    it('keeps markup as plain text', () => {
      const ics = buildIcs(evento({ nomeEvento: '<script>alert(1)</script>' }));
      expect(riga(ics, 'SUMMARY')).toBe('SUMMARY:<script>alert(1)</script>');
    });
  });

  describe('nomeFileSicuro', () => {
    it.each([
      ['Sagra della Porchetta', 'sagra-della-porchetta'],
      ['Città di Castello è bella!', 'citta-di-castello-e-bella'],
      ['  --Festa  del   vino--  ', 'festa-del-vino'],
      ['../../etc/passwd', 'etc-passwd'],
      ['a/b\\c:d*e?f"g<h>i|j', 'a-b-c-d-e-f-g-h-i-j'],
    ])('turns "%s" into "%s"', (input, atteso) => {
      expect(nomeFileSicuro(input)).toBe(atteso);
    });

    it.each(['', '   ', '***', '€€€'])('falls back to "evento" for %j', (input) => {
      expect(nomeFileSicuro(input)).toBe('evento');
    });
  });

  describe('scaricaFile', () => {
    it('clicks a temporary download link, then removes it and revokes the URL', () => {
      vi.useFakeTimers();
      const creaUrl = vi.fn().mockReturnValue('blob:fake');
      const revocaUrl = vi.fn();
      vi.stubGlobal('URL', { createObjectURL: creaUrl, revokeObjectURL: revocaUrl });
      let link: HTMLAnchorElement | undefined;
      let presenteAlClick = false;
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        link = this;
        presenteAlClick = document.body.contains(this);
      });

      scaricaFile('evento.ics', 'BEGIN', 'text/calendar');

      expect(creaUrl).toHaveBeenCalledOnce();
      const blob = creaUrl.mock.calls[0][0] as Blob;
      expect(blob.type).toBe('text/calendar');
      expect(link?.download).toBe('evento.ics');
      expect(link?.getAttribute('href')).toBe('blob:fake');
      expect(presenteAlClick).toBe(true);
      expect(document.body.contains(link ?? null)).toBe(false);

      expect(revocaUrl).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1000);
      expect(revocaUrl).toHaveBeenCalledWith('blob:fake');
    });
  });
});
