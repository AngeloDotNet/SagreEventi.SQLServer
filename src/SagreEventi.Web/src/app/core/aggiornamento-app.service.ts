import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { MessageService } from 'primeng/api';
import { filter, fromEvent, interval, merge } from 'rxjs';

/** How often a long-lived page asks the server for a new version. */
const CONTROLLO_OGNI_MS = 60 * 60 * 1000;
/** Minimum time between two checks triggered by the page coming back to the foreground. */
const CONTROLLO_MINIMO_MS = 5 * 60 * 1000;

/** Tells the user when a new version of the app has been downloaded by the service worker, and applies it on request. */
@Injectable({ providedIn: 'root' })
export class AggiornamentoAppService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly messaggi = inject(MessageService);
  private readonly doc = inject(DOCUMENT);
  private readonly _disponibile = signal(false);
  private ultimoControllo = 0;

  /** True once a new version is ready and waiting to be applied. */
  readonly disponibile = this._disponibile.asReadonly();

  constructor() {
    // Il service worker è spento in sviluppo e nei browser che non lo supportano
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates
      .pipe(
        filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.annuncia());

    // Il browser controlla solo all'avvio e alla navigazione: una PWA lasciata aperta o in background va controllata a mano
    merge(
      interval(CONTROLLO_OGNI_MS),
      fromEvent(this.doc, 'visibilitychange').pipe(
        filter(() => this.doc.visibilityState === 'visible' && Date.now() - this.ultimoControllo >= CONTROLLO_MINIMO_MS),
      ),
    )
      .pipe(takeUntilDestroyed())
      .subscribe(() => void this.controlla());
  }

  /** Asks the server whether a new version exists; when it does, the usual notice appears. Offline and errors are ignored. */
  async controlla(): Promise<void> {
    if (!this.swUpdate.isEnabled) return;
    this.ultimoControllo = Date.now();
    try {
      await this.swUpdate.checkForUpdate();
    } catch {
      // senza rete o con il service worker non pronto: si riprova al prossimo controllo
    }
  }

  private annuncia(): void {
    this._disponibile.set(true);
    this.messaggi.add({
      severity: 'info',
      summary: 'Nuova versione disponibile',
      detail: "Usa l'icona in alto per aggiornare.",
      life: 8000,
    });
  }

  /** Activates the downloaded version and reloads the page (the reload happens even if the activation fails). */
  async aggiorna(): Promise<void> {
    try {
      await this.swUpdate.activateUpdate();
    } finally {
      this.doc.location.reload();
    }
  }
}
