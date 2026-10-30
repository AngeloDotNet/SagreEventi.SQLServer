import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationError, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { filter } from 'rxjs';
import { EventiStore } from './eventi-store.service';

/** Tells the user, with a red toast that stays until closed, when a page cannot be loaded (typically because the device is offline). */
@Injectable({ providedIn: 'root' })
export class ErroreNavigazioneService {
  private readonly messaggi = inject(MessageService);
  private readonly store = inject(EventiStore);

  constructor() {
    inject(Router)
      .events.pipe(
        filter((e): e is NavigationError => e instanceof NavigationError),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.segnala());
  }

  private segnala(): void {
    const offline = !this.store.online();
    this.messaggi.add({
      severity: 'error',
      summary: offline ? 'Sei offline' : 'Pagina non caricata',
      detail: offline
        ? 'Questa pagina non è disponibile senza connessione. Riprova quando torni online.'
        : 'Non è stato possibile aprire la pagina. Riprova.',
      sticky: true,
    });
  }
}
