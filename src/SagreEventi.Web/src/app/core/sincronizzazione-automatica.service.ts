import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, interval, merge } from 'rxjs';
import { EventiStore } from './eventi-store.service';

/** How often a page left open on screen asks the server for news. */
const CONTROLLO_OGNI_MS = 10 * 60 * 1000;
/** Minimum time between two automatic synchronizations, whatever triggers them. */
const INTERVALLO_MINIMO_MS = 5 * 60 * 1000;

/**
 * Keeps the events up to date without the user pressing the sync button: when the page comes back to the foreground
 * and, while it stays visible, every few minutes. It never runs offline, in the background or too often, and a failure
 * is retried only after the minimum interval, so a struggling server is not hammered.
 */
@Injectable({ providedIn: 'root' })
export class SincronizzazioneAutomaticaService {
  private readonly store = inject(EventiStore);
  private readonly doc = inject(DOCUMENT);
  // The app synchronizes once at startup, so the clock starts now
  private ultimoTentativo = Date.now();

  constructor() {
    merge(interval(CONTROLLO_OGNI_MS), fromEvent(this.doc, 'visibilitychange'))
      .pipe(takeUntilDestroyed())
      .subscribe(() => void this.sincronizzaSeServe());
  }

  /** Synchronizes when the page is visible, the device is online and enough time has passed since the last attempt (manual ones included). */
  async sincronizzaSeServe(): Promise<void> {
    if (this.doc.visibilityState !== 'visible' || !this.store.online()) return;

    const ultimaRiuscita = Date.parse(this.store.ultimaSincronizzazione() ?? '') || 0;
    if (Date.now() - Math.max(this.ultimoTentativo, ultimaRiuscita) < INTERVALLO_MINIMO_MS) return;

    this.ultimoTentativo = Date.now();
    await this.store.sincronizza();
  }
}
