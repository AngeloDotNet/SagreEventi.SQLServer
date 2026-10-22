import { Evento, EventoLocale, StatoEvento } from './models';

const pad = (n: number): string => String(n).padStart(2, '0');

/** Date → `YYYY-MM-DDT00:00:00` usando i valori locali (nessuno slittamento di fuso). */
export function toDateOnlyIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00`;
}

/** Stringa del server → Date a mezzanotte locale, ignorando ora e fuso. */
export function parseLocalDate(value: string | null | undefined): Date {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(NaN);
}

export function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/**
 * Timestamp del server → millisecondi epoch.
 * Il server restituisce DateTime "Unspecified" (senza Z): i valori scritti da questo client sono UTC, quindi si assume UTC.
 */
export function parseUtc(value: string | null | undefined): number {
  if (!value) return 0;
  const trimmed = value.replace(/(\.\d{3})\d+/, '$1');
  const hasZone = /T.*(Z|[+-]\d{2}:?\d{2})$/.test(trimmed);
  const t = Date.parse(hasZone ? trimmed : `${trimmed}Z`);
  return Number.isNaN(t) ? 0 : t;
}

const DAY_MS = 86_400_000;

export function giorniTra(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

export function statoEvento(e: Pick<Evento, 'dataInizioEvento' | 'dataFineEvento'>, oggi = startOfToday()): StatoEvento {
  const inizio = parseLocalDate(e.dataInizioEvento).getTime();
  const fine = parseLocalDate(e.dataFineEvento).getTime();
  if (fine < oggi.getTime()) return 'terminato';
  if (inizio > oggi.getTime()) return 'in-arrivo';
  return 'in-corso';
}

export function giorniAllInizio(e: Pick<Evento, 'dataInizioEvento'>, oggi = startOfToday()): number {
  return giorniTra(oggi, parseLocalDate(e.dataInizioEvento));
}

export function statoLabel(e: Pick<Evento, 'dataInizioEvento' | 'dataFineEvento'>): string {
  const stato = statoEvento(e);
  if (stato === 'in-corso') return 'In corso';
  if (stato === 'terminato') return 'Terminato';
  const n = giorniAllInizio(e);
  if (n === 1) return 'Da domani';
  if (n <= 14) return `Fra ${n} giorni`;
  return 'In programma';
}

export type TagSeverity = 'success' | 'warn' | 'secondary';

export function statoSeverity(e: Pick<Evento, 'dataInizioEvento' | 'dataFineEvento'>): TagSeverity {
  const stato = statoEvento(e);
  return stato === 'in-corso' ? 'success' : stato === 'in-arrivo' ? 'warn' : 'secondary';
}

const fmtGiorno = new Intl.DateTimeFormat('it-IT', { day: 'numeric' });
const fmtMeseBreve = new Intl.DateTimeFormat('it-IT', { month: 'short' });
const fmtCompleta = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtLunga = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtMeseAnno = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });

export function formatPeriodo(e: Pick<Evento, 'dataInizioEvento' | 'dataFineEvento'>): string {
  const i = parseLocalDate(e.dataInizioEvento);
  const f = parseLocalDate(e.dataFineEvento);
  if (Number.isNaN(i.getTime()) || Number.isNaN(f.getTime())) return '';
  if (i.getTime() === f.getTime()) return fmtCompleta.format(i);
  if (i.getFullYear() === f.getFullYear() && i.getMonth() === f.getMonth()) {
    return `${fmtGiorno.format(i)}–${fmtCompleta.format(f)}`;
  }
  if (i.getFullYear() === f.getFullYear()) {
    return `${fmtGiorno.format(i)} ${fmtMeseBreve.format(i)} – ${fmtCompleta.format(f)}`;
  }
  return `${fmtCompleta.format(i)} – ${fmtCompleta.format(f)}`;
}

export function formatDataLunga(value: string): string {
  return fmtLunga.format(parseLocalDate(value));
}

export function formatMeseAnno(d: Date): string {
  return fmtMeseAnno.format(d);
}

export function giornoMese(value: string): { giorno: string; mese: string } {
  const d = parseLocalDate(value);
  return { giorno: fmtGiorno.format(d), mese: fmtMeseBreve.format(d).replace('.', '') };
}

export function durataGiorni(e: Pick<Evento, 'dataInizioEvento' | 'dataFineEvento'>): number {
  return giorniTra(parseLocalDate(e.dataInizioEvento), parseLocalDate(e.dataFineEvento)) + 1;
}

/** Minuscolo e senza accenti, per ricerche tolleranti. */
export function normalizzaTesto(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function confrontaPerInizio(a: Evento, b: Evento): number {
  return parseLocalDate(a.dataInizioEvento).getTime() - parseLocalDate(b.dataInizioEvento).getTime();
}

/** Evento locale → payload API (senza campi solo-locali). */
export function toApiPayload(e: EventoLocale): Evento {
  return {
    id: e.id,
    nomeEvento: e.nomeEvento,
    cittaEvento: e.cittaEvento,
    dataInizioEvento: e.dataInizioEvento,
    dataFineEvento: e.dataFineEvento,
    descrizioneEvento: e.descrizioneEvento,
    eventoConcluso: e.eventoConcluso,
    dataOraUltimaModifica: e.dataOraUltimaModifica,
  };
}

export function nuovoId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/* ---------- Aspetto di un evento: emoji + gradiente scelti dal tema, senza immagini ---------- */

interface Motivo {
  re: RegExp;
  emoji: string;
  gradient: string;
}

const MOTIVI: Motivo[] = [
  { re: /\b(vino|vini|vendemmia|cantin\w*|calici|degustazion\w* di vin\w*|uva)\b/, emoji: '🍷', gradient: 'linear-gradient(135deg,#6c1d35,#c2416a)' },
  { re: /\b(birra|birre|birrific\w*|luppol\w*)\b/, emoji: '🍺', gradient: 'linear-gradient(135deg,#92400e,#f5a524)' },
  { re: /\b(pizza|pizze)\b/, emoji: '🍕', gradient: 'linear-gradient(135deg,#9a3412,#f97316)' },
  { re: /\b(tartuf\w*|funghi|fungo|porcin\w*)\b/, emoji: '🍄', gradient: 'linear-gradient(135deg,#3f2a1d,#a16207)' },
  { re: /\b(castagn\w*|marron\w*)\b/, emoji: '🌰', gradient: 'linear-gradient(135deg,#5b3a1e,#b45309)' },
  { re: /\b(olio|oliv\w*|frantoi\w*)\b/, emoji: '🫒', gradient: 'linear-gradient(135deg,#365314,#84a82a)' },
  { re: /\b(formagg\w*|latte|latticin\w*|pecorin\w*|mozzarell\w*)\b/, emoji: '🧀', gradient: 'linear-gradient(135deg,#a16207,#facc15)' },
  { re: /\b(pesce|pesci|mare|sardin\w*|acciugh\w*|frutti di mare|baccal\w*)\b/, emoji: '🐟', gradient: 'linear-gradient(135deg,#0c4a6e,#38bdf8)' },
  { re: /\b(porchett\w*|salsicc\w*|carne|bistecc\w*|arrost\w*|grigliat\w*|salum\w*|prosciutt\w*|maial\w*)\b/, emoji: '🥩', gradient: 'linear-gradient(135deg,#7f1d1d,#ef4444)' },
  { re: /\b(cioccolat\w*|dolc\w*|torta|torte|gelat\w*|miele)\b/, emoji: '🍫', gradient: 'linear-gradient(135deg,#4a2c2a,#b8654b)' },
  { re: /\b(pane|pani|farina|grano|forno)\b/, emoji: '🥖', gradient: 'linear-gradient(135deg,#854d0e,#e8b04a)' },
  { re: /\b(mele|mela|pere|ciliegi\w*|fragol\w*|frutta|pesche|albicocch\w*)\b/, emoji: '🍎', gradient: 'linear-gradient(135deg,#991b1b,#f87171)' },
  { re: /\b(pasta|tortellin\w*|gnocch\w*|ravioli|polenta|risott\w*|riso)\b/, emoji: '🍝', gradient: 'linear-gradient(135deg,#a16207,#fb923c)' },
  { re: /\b(zucca|zucche|patat\w*|ortaggi|carciof\w*|asparag\w*|radicchi\w*)\b/, emoji: '🥬', gradient: 'linear-gradient(135deg,#14532d,#4ade80)' },
];

const FALLBACK: { emoji: string; gradient: string }[] = [
  { emoji: '🍽️', gradient: 'linear-gradient(135deg,#99213f,#e56f8c)' },
  { emoji: '🎪', gradient: 'linear-gradient(135deg,#1e3a8a,#60a5fa)' },
  { emoji: '🥘', gradient: 'linear-gradient(135deg,#9a3412,#fbbf24)' },
  { emoji: '🍴', gradient: 'linear-gradient(135deg,#14532d,#4ade80)' },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function visualEvento(e: Pick<Evento, 'id' | 'nomeEvento' | 'descrizioneEvento'>): { emoji: string; gradient: string } {
  const testo = normalizzaTesto(`${e.nomeEvento} ${e.descrizioneEvento}`);
  const nome = normalizzaTesto(e.nomeEvento);
  const trovato = MOTIVI.find((m) => m.re.test(nome)) ?? MOTIVI.find((m) => m.re.test(testo));
  return trovato ?? FALLBACK[hash(e.id || e.nomeEvento) % FALLBACK.length];
}
