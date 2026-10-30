import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { EventiStore } from '../../../core/eventi-store.service';
import { PermessiService } from '../../../core/permessi.service';
import {
  durataGiorni,
  formatDataLunga,
  formatPeriodo,
  statoLabel,
  statoSeverity,
  TagSeverity,
  visualEvento,
} from '../../../core/evento-utils';
import { buildIcs, nomeFileSicuro, scaricaFile } from '../../../core/ics';
import { EmptyStateComponent } from '../../../shared/empty-state.component';

@Component({
  selector: 'app-evento-detail',
  imports: [RouterLink, ButtonModule, TagModule, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './evento-detail.component.html',
})
export class EventoDetailComponent {
  /** Parametro di rotta `:id`, legato tramite withComponentInputBinding. */
  readonly id = input.required<string>();

  protected readonly store = inject(EventiStore);
  protected readonly permessi = inject(PermessiService);
  private readonly messaggi = inject(MessageService);

  protected readonly evento = computed(() => this.store.trova(this.id()));
  protected readonly visual = computed(() => {
    const e = this.evento();
    return e ? visualEvento(e) : { emoji: '🍽️', gradient: '' };
  });
  protected readonly label = computed(() => {
    const e = this.evento();
    return e ? statoLabel(e) : '';
  });
  protected readonly severity = computed<TagSeverity>(() => {
    const e = this.evento();
    return e ? statoSeverity(e) : 'secondary';
  });
  protected readonly periodo = computed(() => {
    const e = this.evento();
    return e ? formatPeriodo(e) : '';
  });
  protected readonly durata = computed(() => {
    const e = this.evento();
    return e ? durataGiorni(e) : 0;
  });
  protected readonly inizioLungo = computed(() => {
    const e = this.evento();
    return e ? formatDataLunga(e.dataInizioEvento) : '';
  });
  protected readonly fineLunga = computed(() => {
    const e = this.evento();
    return e ? formatDataLunga(e.dataFineEvento) : '';
  });
  protected readonly urlMappa = computed(() => {
    const e = this.evento();
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e?.cittaEvento ?? '')}`;
  });

  protected aggiungiAlCalendario(): void {
    const e = this.evento();
    if (!e) return;
    scaricaFile(`${nomeFileSicuro(e.nomeEvento)}.ics`, buildIcs(e), 'text/calendar;charset=utf-8');
    this.messaggi.add({ severity: 'success', summary: 'File del calendario scaricato', detail: 'Aprilo per aggiungere l\'evento.', life: 4000 });
  }

  protected async condividi(): Promise<void> {
    const e = this.evento();
    if (!e) return;
    const testo = `${e.nomeEvento} a ${e.cittaEvento}, ${formatPeriodo(e)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: e.nomeEvento, text: testo, url: location.href });
      } else {
        await navigator.clipboard.writeText(`${testo}\n${location.href}`);
        this.messaggi.add({ severity: 'success', summary: 'Copiato negli appunti', life: 3000 });
      }
    } catch {
      // condivisione annullata dall'utente o non consentita
    }
  }
}
