/** A piece of an event description: plain text, or a web link found inside it. */
export type SegmentoTesto =
  | { tipo: 'testo'; testo: string }
  | { tipo: 'link'; testo: string; url: string; host: string };

/** A link segment. */
export type SegmentoLink = Extract<SegmentoTesto, { tipo: 'link' }>;

const REGEX_INDIRIZZO = /https?:\/\/[^\s<>"']+/gi;
const PUNTEGGIATURA_FINALE = /[.,;:!?)\]}]+$/;
const LUNGHEZZA_MASSIMA_URL = 2000;

/**
 * Splits a free text into plain-text and link segments, so a template can draw each link as an anchor
 * without ever building HTML from the text. Only absolute `http` and `https` addresses become links:
 * any other scheme (javascript:, data:, mailto:...) stays plain text, as do addresses with credentials
 * or longer than 2000 characters. Trailing punctuation is left out of the link. Line breaks are kept.
 */
export function segmentaTesto(testo: string): SegmentoTesto[] {
  const segmenti: SegmentoTesto[] = [];
  let ultimo = 0;

  for (const trovato of testo.matchAll(REGEX_INDIRIZZO)) {
    const inizio = trovato.index;
    const candidato = trovato[0].replace(PUNTEGGIATURA_FINALE, '');
    const link = creaLink(candidato);
    if (!link) continue;

    aggiungiTesto(segmenti, testo.slice(ultimo, inizio));
    segmenti.push(link);
    ultimo = inizio + candidato.length;
  }

  aggiungiTesto(segmenti, testo.slice(ultimo));
  return segmenti;
}

/** The first link of a segmented text, or `undefined` when the text has none. */
export const primoLink = (segmenti: readonly SegmentoTesto[]): SegmentoLink | undefined =>
  segmenti.find((s): s is SegmentoLink => s.tipo === 'link');

function creaLink(indirizzo: string): SegmentoLink | null {
  if (indirizzo.length > LUNGHEZZA_MASSIMA_URL) return null;

  let url: URL;
  try {
    url = new URL(indirizzo);
  } catch {
    return null;
  }

  const schemaAmmesso = url.protocol === 'http:' || url.protocol === 'https:';
  if (!schemaAmmesso || !url.hostname || url.username || url.password) return null;

  return { tipo: 'link', testo: indirizzo, url: url.href, host: url.hostname.replace(/^www\./i, '') };
}

function aggiungiTesto(segmenti: SegmentoTesto[], testo: string): void {
  if (!testo) return;
  const ultimo = segmenti.at(-1);
  if (ultimo?.tipo === 'testo') {
    segmenti[segmenti.length - 1] = { tipo: 'testo', testo: ultimo.testo + testo };
  } else {
    segmenti.push({ tipo: 'testo', testo });
  }
}
