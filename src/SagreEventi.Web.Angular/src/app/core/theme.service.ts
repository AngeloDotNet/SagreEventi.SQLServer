import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

const KEY = 'sagreeventi.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  readonly scuro = signal(this.iniziale());

  constructor() {
    effect(() => this.doc.documentElement.classList.toggle('app-dark', this.scuro()));
  }

  alterna(): void {
    this.scuro.update((v) => !v);
    try {
      localStorage.setItem(KEY, this.scuro() ? 'dark' : 'light');
    } catch {
      // preferenza non persistita
    }
  }

  private iniziale(): boolean {
    try {
      const salvato = localStorage.getItem(KEY);
      if (salvato) return salvato === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  }
}
