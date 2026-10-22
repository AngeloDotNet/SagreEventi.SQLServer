import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { EventiStore } from '../../core/eventi-store.service';
import { PermessiService } from '../../core/permessi.service';
import {
  durataGiorni,
  formatDataLunga,
  formatPeriodo,
  statoEvento,
  statoLabel,
  statoSeverity,
  TagSeverity,
  visualEvento,
} from '../../core/evento-utils';
import { buildIcs, nomeFileSicuro, scaricaFile } from '../../core/ics';
import { EmptyState } from '../../shared/empty-state';

@Component({
  selector: 'app-evento-detail-page',
  imports: [RouterLink, ButtonModule, TagModule, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (evento(); as e) {
      <article>
        <div class="dettaglio-cover" [style.background]="visual().gradient">
          <div class="container">
            <a routerLink="/eventi" class="indietro"><i class="pi pi-arrow-left" aria-hidden="true"></i>Tutti gli eventi</a>
            <span class="dettaglio-emoji" aria-hidden="true">{{ visual().emoji }}</span>
          </div>
        </div>

        <div class="container dettaglio-corpo">
          <div class="dettaglio-principale">
            <div class="ev-top">
              <p-tag [value]="label()" [severity]="severity()" [rounded]="true" />
              @if (e.dirty) {
                <span class="ev-pending"><i class="pi pi-cloud-upload" aria-hidden="true"></i> In attesa di invio al server</span>
              }
            </div>
            <h1>{{ e.nomeEvento }}</h1>

            <dl class="dettaglio-dati">
              <div>
                <dt>Dove</dt>
                <dd>{{ e.cittaEvento }}</dd>
              </div>
              <div>
                <dt>Quando</dt>
                <dd>{{ periodo() }}</dd>
              </div>
              <div>
                <dt>Durata</dt>
                <dd>{{ durata() === 1 ? '1 giorno' : durata() + ' giorni' }}</dd>
              </div>
            </dl>

            <p class="dettaglio-descrizione">{{ e.descrizioneEvento }}</p>
            <p class="dettaglio-nota">Dal {{ inizioLungo() }} al {{ fineLunga() }}.</p>
          </div>

          <aside class="dettaglio-azioni" aria-label="Azioni">
            <p-button label="Aggiungi al calendario" icon="pi pi-calendar-plus" (onClick)="aggiungiAlCalendario()" />
            <a class="btn btn-contorno btn-pieno" [href]="urlMappa()" target="_blank" rel="noopener">
              <i class="pi pi-map-marker" aria-hidden="true"></i>Apri la mappa
            </a>
            <p-button label="Condividi" icon="pi pi-share-alt" severity="secondary" [outlined]="true" (onClick)="condividi()" />
            @if (permessi.puoModificare()) {
              <hr />
              <a [routerLink]="['/eventi', e.id, 'modifica']" class="btn btn-contorno btn-pieno">
                <i class="pi pi-pencil" aria-hidden="true"></i>Modifica
              </a>
              <p-button label="Segna come concluso" icon="pi pi-check" severity="secondary" [text]="true" (onClick)="chiediConclusione()" />
            }
          </aside>
        </div>
      </article>
    } @else {
      <div class="container pagina">
        <app-empty-state
          icona="🧭"
          titolo="Evento non trovato"
          testo="Potrebbe essere stato concluso oppure non è ancora stato scaricato su questo dispositivo. Prova a sincronizzare."
        >
          <button type="button" class="btn btn-primario" [disabled]="store.sincronizzando()" (click)="store.sincronizza()">Sincronizza ora</button>
          <a routerLink="/eventi" class="btn btn-contorno">Vai a tutti gli eventi</a>
        </app-empty-state>
      </div>
    }
  `,
})
export class EventoDetailPage {
  /** Parametro di rotta `:id`, legato tramite withComponentInputBinding. */
  readonly id = input.required<string>();

  protected readonly store = inject(EventiStore);
  protected readonly permessi = inject(PermessiService);
  private readonly router = inject(Router);
  private readonly messaggi = inject(MessageService);
  private readonly conferme = inject(ConfirmationService);

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

  protected chiediConclusione(): void {
    const e = this.evento();
    if (!e || !this.permessi.puoModificare()) return;
    const stato = statoEvento(e);
    this.conferme.confirm({
      header: 'Segnare come concluso?',
      message:
        stato === 'terminato'
          ? `«${e.nomeEvento}» è già finito. Segnandolo come concluso sparisce dall'elenco.`
          : `«${e.nomeEvento}» non è ancora finito. Segnandolo come concluso sparisce dall'elenco per tutti.`,
      icon: 'pi pi-check-circle',
      acceptLabel: 'Segna come concluso',
      rejectLabel: 'Annulla',
      accept: () => {
        this.store.concludi(e.id);
        void this.store.sincronizza();
        this.messaggi.add({ severity: 'success', summary: 'Evento concluso', detail: 'Non compare più nell\'elenco.', life: 4000 });
        void this.router.navigate(['/eventi']);
      },
    });
  }
}
