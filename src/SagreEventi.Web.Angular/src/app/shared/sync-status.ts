import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { EventiStore } from '../core/eventi-store.service';

@Component({
  selector: 'app-sync-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="sync"
      [class.is-offline]="!store.online()"
      [class.has-error]="!!store.erroreSync()"
      [disabled]="store.sincronizzando()"
      [attr.aria-label]="'Sincronizza ora. ' + dettaglio()"
      [attr.title]="dettaglio()"
      (click)="store.sincronizza()"
    >
      <i class="pi pi-sync" [class.spin]="store.sincronizzando()" aria-hidden="true"></i>
      <span class="sync-testo">{{ breve() }}</span>
    </button>
  `,
})
export class SyncStatus {
  protected readonly store = inject(EventiStore);

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
