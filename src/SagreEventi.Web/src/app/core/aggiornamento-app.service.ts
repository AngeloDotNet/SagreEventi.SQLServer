import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { MessageService } from 'primeng/api';
import { filter } from 'rxjs';

/** Tells the user when a new version of the app has been downloaded by the service worker, and applies it on request. */
@Injectable({ providedIn: 'root' })
export class AggiornamentoAppService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly messaggi = inject(MessageService);
  private readonly doc = inject(DOCUMENT);
  private readonly _disponibile = signal(false);

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
