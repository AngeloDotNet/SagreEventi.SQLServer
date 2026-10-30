import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { EventiStore } from '../core/eventi-store.service';

/** Icon-only sync button: the state is in the tooltip, and a sync error is also shown to the user as a toast. */
@Component({
  selector: 'app-sync-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sync-status.component.html',
})
export class SyncStatusComponent {
  protected readonly store = inject(EventiStore);
  private readonly messaggi = inject(MessageService);

  constructor() {

    effect(() => {
      const errore = this.store.erroreSync();
      if (errore) {
        this.messaggi.add({ severity: 'error', summary: 'Sincronizzazione non riuscita', detail: errore, life: 8000 });
      }
    });
  }

  protected readonly breve = computed(() => {
    if (this.store.sincronizzando()) return 'Sincronizzo';
    if (!this.store.online()) return 'Offline';
    if (this.store.erroreSync()) return 'Errore';
    const n = this.store.daInviare();
    return n > 0 ? `${n} da inviare` : 'Aggiornato';
  });

  protected readonly dettaglio = computed(() => {
    const errore = this.store.erroreSync();
    if (errore) return errore;
    if (!this.store.online()) return 'Sei offline: le modifiche restano sul dispositivo e partiranno appena torni online.';
    const quando = this.store.ultimaSincronizzazione();
    const n = this.store.daInviare();
    const parti: string[] = [];
    if (n > 0) parti.push(n === 1 ? '1 modifica da inviare.' : `${n} modifiche da inviare.`);
    parti.push(
      quando
        ? `Ultima sincronizzazione alle ${new Date(quando).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}.`
        : 'Non ancora sincronizzato.',
    );
    return parti.join(' ');
  });
}
