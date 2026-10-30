import { Evento } from './models';
import { parseLocalDate } from './evento-utils';

const pad = (n: number): string => String(n).padStart(2, '0');
const ymd = (d: Date): string => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const esc = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Evento di calendario (.ics) a giornata intera. DTEND è esclusivo, quindi si aggiunge un giorno. */
export function buildIcs(e: Evento): string {
  const inizio = parseLocalDate(e.dataInizioEvento);
  const fineEsclusiva = parseLocalDate(e.dataFineEvento);
  fineEsclusiva.setDate(fineEsclusiva.getDate() + 1);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SagreEventi//IT',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${e.id}@sagreeventi`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(inizio)}`,
    `DTEND;VALUE=DATE:${ymd(fineEsclusiva)}`,
    `SUMMARY:${esc(e.nomeEvento)}`,
    `LOCATION:${esc(e.cittaEvento)}`,
    `DESCRIPTION:${esc(e.descrizioneEvento)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function scaricaFile(nome: string, contenuto: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([contenuto], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function nomeFileSicuro(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'evento';
}
