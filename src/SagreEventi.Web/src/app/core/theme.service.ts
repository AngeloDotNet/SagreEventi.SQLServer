import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

const KEY = 'sagreeventi.theme';

/** Available themes. */
export type Tema = 'light' | 'dark' | 'pasqua' | 'ferragosto' | 'halloween' | 'natale' | 'natale-scuro';

const TEMI: readonly Tema[] = ['light', 'dark', 'pasqua', 'ferragosto', 'halloween', 'natale', 'natale-scuro'];

/** Themes built on the PrimeNG dark surfaces. */
const TEMI_SCURI: ReadonlySet<Tema> = new Set<Tema>(['dark', 'halloween', 'natale-scuro']);

/** Document class of each themed palette (light and dark use only the PrimeNG dark class). */
const CLASSI_TEMA: Readonly<Partial<Record<Tema, string>>> = {
  pasqua: 'app-pasqua',
  ferragosto: 'app-ferragosto',
  halloween: 'app-halloween',
  natale: 'app-natale',
  'natale-scuro': 'app-natale-scuro',
};

/** Day of the year as month * 100 + day, to compare dates without the year. */
const giornoDellAnno = (data: Date): number => (data.getMonth() + 1) * 100 + data.getDate();

/** Fixed period from `da` to `a` (inclusive, month * 100 + day); `da` > `a` means it spans the new year. */
const periodo =
  (da: number, a: number) =>
  (oggi: Date): boolean => {
    const giorno = giornoDellAnno(oggi);
    return da <= a ? giorno >= da && giorno <= a : giorno >= da || giorno <= a;
  };

/** Easter Sunday of the given year (Gregorian calendar, Meeus/Jones/Butcher algorithm). */
export function pasqua(anno: number): Date {
  const a = anno % 19;
  const b = Math.floor(anno / 100);
  const c = anno % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31);
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anno, mese - 1, giorno);
}

/** From Palm Sunday (7 days before Easter) to Easter Monday. */
const settimanaDiPasqua = (oggi: Date): boolean => {
  const inizio = pasqua(oggi.getFullYear()).getTime();
  const giorni = Math.round((new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate()).getTime() - inizio) / 86_400_000);
  return giorni >= -7 && giorni <= 1;
};

/** Seasonal themes: when each one is available. The other themes are always available. */
const STAGIONI: Readonly<Partial<Record<Tema, (oggi: Date) => boolean>>> = {
  pasqua: settimanaDiPasqua,
  ferragosto: periodo(801, 820),
  halloween: periodo(1015, 1102),
  natale: periodo(1201, 106),
  'natale-scuro': periodo(1201, 106),
};

/** Whether the theme can be chosen on the given day: the seasonal ones only around their holiday, the others always. */
export function inStagione(tema: Tema, oggi: Date = new Date()): boolean {
  return STAGIONI[tema]?.(oggi) ?? true;
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);

  /** The current theme. */
  readonly tema = signal<Tema>(this.iniziale());
  readonly scuro = computed(() => this.tema() === 'dark');

  constructor() {
    effect(() => {
      const tema = this.tema();
      const classi = this.doc.documentElement.classList;
      classi.toggle('app-dark', TEMI_SCURI.has(tema));
      for (const [nome, classe] of Object.entries(CLASSI_TEMA)) classi.toggle(classe, tema === nome);
    });
  }

  /** Switches to the given theme and saves the choice (the switch works even if it cannot be saved). */
  imposta(tema: Tema): void {
    this.tema.set(tema);
    try {
      localStorage.setItem(KEY, tema);
    } catch {
      // preferenza non persistita
    }
  }

  /** Saved theme if it still exists and is in season; an unknown one is light; an expired seasonal one falls back to the system preference. */
  private iniziale(): Tema {
    try {
      const salvato = localStorage.getItem(KEY);
      const tema = TEMI.find((t) => t === salvato);
      if (tema && inStagione(tema)) return tema;
      if (salvato && !tema) return 'light';
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }
}
