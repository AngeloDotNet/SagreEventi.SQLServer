import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { EventiStore } from '../../core/eventi-store.service';
import { formatPeriodo } from '../../core/evento-utils';
import { Evento } from '../../core/models';
import { PermessiService } from '../../core/permessi.service';
import { RevisioneService, StatoDaRivedere } from '../../core/revisione.service';
import { EmptyState } from '../../shared/empty-state';

const MAX_MOTIVO = 500;
/** Il server accetta al massimo 100 id per richiesta. */
const MAX_ID = 100;
/** Il server restituisce al massimo 200 eventi conclusi, i più recenti. */
const MAX_CONCLUSI = 200;

/**
 * Schede della pagina: "Approvato" non esiste lato server tra i da rivedere, si legge dallo store (eventi pubblici);
 * "Concluso" (solo Admin, sola lettura) elenca gli eventi scaduti o ritirati in ogni stato.
 */
type Scheda = StatoDaRivedere | 'Approvato' | 'Concluso';

const ETICHETTA_STATO = { InAttesa: 'In attesa', Approvato: 'Approvato', Rifiutato: 'Rifiutato' };

/** Revisione delle segnalazioni (Admin ed Editor): approvazione e rifiuto multipli, ritiro di eventi già approvati. */
@Component({
  selector: 'app-revisione-page',
  imports: [FormsModule, RouterLink, ButtonModule, DialogModule, MessageModule, SelectButtonModule, TableModule, TextareaModule, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container pagina">
      <h1>Revisione eventi</h1>
      <p class="pagina-intro larga">
        Le segnalazioni diventano pubbliche solo dopo l'approvazione. Un evento rifiutato non è visibile a nessuno e
        chi l'ha segnalato non riceve alcuna comunicazione: la nota facoltativa resta solo qui, come storico per lo staff.
        Da «Approvati» puoi ritirare un evento già pubblico.
        @if (permessi.eAdmin()) {
          Da «Conclusi» l'Admin consulta gli eventi scaduti o ritirati, in sola lettura.
        }
      </p>

      <p-selectbutton
        [options]="schede()"
        [ngModel]="stato()"
        (ngModelChange)="cambiaScheda($event)"
        optionLabel="etichetta"
        optionValue="valore"
        [allowEmpty]="false"
        ariaLabelledBy="Stato degli eventi"
      />

      @if (!store.online()) {
        <p-message severity="warn" styleClass="mt">Sei offline: la revisione richiede la connessione al server.</p-message>
      } @else if (errore()) {
        <p-message severity="error" styleClass="mt">{{ errore() }}</p-message>
      }

      @if (eventi().length === 0 && !caricamento()) {
        <app-empty-state
          [icona]="stato() === 'InAttesa' ? '✅' : '🗂️'"
          [titolo]="titoloVuoto()"
          testo="La lista si aggiorna a ogni apertura della pagina."
        >
          <p-button label="Ricarica" icon="pi pi-refresh" severity="secondary" (onClick)="carica()" />
        </app-empty-state>
      } @else {
        <div class="azioni-bulk">
          @if (stato() === 'Concluso') {
            <span class="conteggio">{{ eventi().length }} eventi conclusi (i più recenti, al massimo {{ maxConclusi }})</span>
          } @else {
            <span class="conteggio">{{ selezionati().length }} selezionati su {{ eventi().length }}</span>
            @if (stato() !== 'Approvato') {
              <p-button label="Approva" icon="pi pi-check" [disabled]="!selezioneValida() || occupato()" (onClick)="approva()" />
            }
            @if (stato() !== 'Rifiutato') {
              <p-button [label]="stato() === 'Approvato' ? 'Ritira…' : 'Rifiuta…'" icon="pi pi-times" severity="danger" [outlined]="true" [disabled]="!selezioneValida() || occupato()" (onClick)="apriRifiuto()" />
            }
          }
          <p-button icon="pi pi-refresh" severity="secondary" [text]="true" ariaLabel="Ricarica" [disabled]="caricamento()" (onClick)="carica()" />
        </div>
        @if (selezionati().length > maxId) {
          <p-message severity="warn" styleClass="mt">Si possono elaborare al massimo {{ maxId }} eventi per volta.</p-message>
        }

        <p-table
          [value]="eventi()"
          [selection]="selezionati()"
          (selectionChange)="selezionati.set($event)"
          dataKey="id"
          [loading]="caricamento()"
          [scrollable]="true"
          [tableStyle]="{ 'min-width': '40rem' }"
        >
          <ng-template #header>
            <tr>
              @if (stato() !== 'Concluso') {
                <th style="width: 3rem"><p-tableHeaderCheckbox ariaLabel="Seleziona tutti" /></th>
              }
              <th>Evento</th>
              <th>Città</th>
              <th>Date</th>
              @if (stato() === 'Concluso') {
                <th>Stato</th>
              }
              @if (stato() === 'Rifiutato' || stato() === 'Concluso') {
                <th>Nota</th>
              }
            </tr>
          </ng-template>
          <ng-template #body let-e>
            <tr>
              @if (stato() !== 'Concluso') {
                <td><p-tableCheckbox [value]="e" [ariaLabel]="'Seleziona ' + e.nomeEvento" /></td>
              }
              <td>
                <strong>{{ e.nomeEvento }}</strong>
                <div class="descrizione">{{ e.descrizioneEvento }}</div>
              </td>
              <td>{{ e.cittaEvento }}</td>
              <td>{{ periodo(e) }}</td>
              @if (stato() === 'Concluso') {
                <td>{{ etichettaStato(e) }}</td>
              }
              @if (stato() === 'Rifiutato' || stato() === 'Concluso') {
                <td>{{ e.motivoRifiuto || '—' }}</td>
              }
            </tr>
          </ng-template>
        </p-table>
      }

      <a routerLink="/eventi" class="btn btn-testo torna">Torna agli eventi</a>
    </div>

    <p-dialog [header]="stato() === 'Approvato' ? 'Ritira gli eventi' : 'Rifiuta le segnalazioni'" [modal]="true" [(visible)]="dialogoAperto" [style]="{ width: 'min(32rem, 94vw)' }" [draggable]="false">
      <p>
        {{ selezionati().length === 1 ? 'Stai ' + (stato() === 'Approvato' ? 'ritirando' : 'rifiutando') + ' 1 evento.' : 'Stai ' + (stato() === 'Approvato' ? 'ritirando ' : 'rifiutando ') + selezionati().length + ' eventi.' }}
        {{ stato() === 'Approvato' ? 'Spariranno dagli elenchi di tutti alla prossima sincronizzazione. ' : '' }}Chi li ha segnalati non riceverà nessuna comunicazione.
      </p>
      <label for="motivo">Nota (facoltativa, visibile solo allo staff)</label>
      <textarea
        pTextarea
        id="motivo"
        rows="4"
        [maxlength]="maxMotivo"
        [ngModel]="motivo()"
        (ngModelChange)="motivo.set($event)"
        placeholder="Es. contenuto non pertinente, evento duplicato… (puoi lasciarla vuota)"
      ></textarea>
      <small>{{ motivo().length }} / {{ maxMotivo }}</small>
      <ng-template #footer>
        <p-button label="Annulla" severity="secondary" [text]="true" (onClick)="dialogoAperto.set(false)" />
        <p-button [label]="stato() === 'Approvato' ? 'Ritira' : 'Rifiuta'" icon="pi pi-times" severity="danger" [disabled]="occupato()" (onClick)="rifiuta()" />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .azioni-bulk { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin: 1rem 0; }
    .conteggio { margin-right: auto; }
    .descrizione { max-width: 42ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.75; font-size: 0.9em; }
    textarea { width: 100%; }
    .torna { margin-top: 1.5rem; }
  `,
})
export class RevisionePage implements OnInit {
  protected readonly store = inject(EventiStore);
  private readonly servizio = inject(RevisioneService);
  private readonly messaggi = inject(MessageService);

  protected readonly permessi = inject(PermessiService);

  /** La scheda «Conclusi» è riservata all'Admin (il server risponde 403 agli altri). */
  protected readonly schede = computed(() => {
    const base = [
      { etichetta: 'In attesa', valore: 'InAttesa' as Scheda },
      { etichetta: 'Rifiutati', valore: 'Rifiutato' as Scheda },
      { etichetta: 'Approvati', valore: 'Approvato' as Scheda },
    ];
    return this.permessi.eAdmin() ? [...base, { etichetta: 'Conclusi', valore: 'Concluso' as Scheda }] : base;
  });
  protected readonly maxId = MAX_ID;
  protected readonly maxConclusi = MAX_CONCLUSI;
  protected readonly maxMotivo = MAX_MOTIVO;

  protected readonly stato = signal<Scheda>('InAttesa');
  protected readonly eventi = signal<Evento[]>([]);
  protected readonly selezionati = signal<Evento[]>([]);
  protected readonly caricamento = signal(false);
  protected readonly occupato = signal(false);
  protected readonly errore = signal<string | null>(null);
  protected readonly dialogoAperto = signal(false);
  protected readonly motivo = signal('');

  protected readonly selezioneValida = computed(() => this.selezionati().length > 0 && this.selezionati().length <= MAX_ID);

  protected readonly titoloVuoto = computed(() =>
    ({
      InAttesa: 'Nessuna segnalazione da rivedere',
      Rifiutato: 'Nessun evento rifiutato',
      Approvato: 'Nessun evento approvato',
      Concluso: 'Nessun evento concluso',
    })[this.stato()],
  );

  protected periodo = formatPeriodo;

  protected etichettaStato(e: Evento): string {
    return e.stato ? ETICHETTA_STATO[e.stato] : '—';
  }

  ngOnInit(): void {
    void this.carica();
  }

  protected cambiaScheda(stato: Scheda): void {
    this.stato.set(stato);
    void this.carica();
  }

  protected async carica(): Promise<void> {
    this.caricamento.set(true);
    this.errore.set(null);
    this.selezionati.set([]);
    try {
      const stato = this.stato();
      // Gli approvati sono i pubblici già presenti nello store locale (sincronizzato col server)
      this.eventi.set(
        stato === 'Approvato' ? [...this.store.eventi()] : stato === 'Concluso' ? await this.servizio.conclusi() : await this.servizio.daRivedere(stato),
      );
    } catch (err) {
      this.eventi.set([]);
      this.errore.set(messaggioErrore(err, 'Impossibile leggere gli eventi da rivedere.'));
    } finally {
      this.caricamento.set(false);
    }
  }

  protected async approva(): Promise<void> {
    const n = await this.esegui((ids) => this.servizio.approva(ids));
    if (n !== null) this.esito(n, 'approvat');
  }

  protected apriRifiuto(): void {
    this.motivo.set('');
    this.dialogoAperto.set(true);
  }

  protected async rifiuta(): Promise<void> {
    const motivo = this.motivo().trim();
    const n = await this.esegui((ids) => this.servizio.rifiuta(ids, motivo));
    if (n !== null) {
      this.dialogoAperto.set(false);
      this.esito(n, 'rifiutat');
    }
  }

  /** Invia l'azione sugli eventi selezionati, poi ricarica la lista. Restituisce quanti ne sono cambiati, o null se fallita. */
  private async esegui(azione: (ids: string[]) => Promise<{ modificati: number }>): Promise<number | null> {
    const ids = this.selezionati().map((e) => e.id);
    if (ids.length === 0 || ids.length > MAX_ID) return null;
    this.occupato.set(true);
    try {
      const { modificati } = await azione(ids);
      await this.carica();
      // La lista dei rifiutati non aggiorna il contatore del menu, che conta le sole segnalazioni in attesa
      if (this.stato() !== 'InAttesa') await this.servizio.aggiornaConteggio();
      // Un ritiro arriva ai client come tombstone: lo ricevo subito anche qui
      if (this.stato() === 'Approvato') {
        await this.store.sincronizza();
        await this.carica();
      }
      return modificati;
    } catch (err) {
      this.messaggi.add({ severity: 'error', summary: 'Operazione non riuscita', detail: messaggioErrore(err, 'Riprova tra poco.'), life: 7000 });
      return null;
    } finally {
      this.occupato.set(false);
    }
  }

  private esito(n: number, radice: string): void {
    const summary = n === 0 ? 'Nessuna modifica' : `${n} ${n === 1 ? 'evento' : 'eventi'} ${radice}${n === 1 ? 'o' : 'i'}`;
    this.messaggi.add({ severity: 'success', summary, life: 4000 });
  }
}

function messaggioErrore(err: unknown, predefinito: string): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 401 || err.status === 403) return 'Non hai i permessi per questa operazione: accedi di nuovo.';
    if (err.status === 0) return 'Server non raggiungibile.';
  }
  return predefinito;
}
