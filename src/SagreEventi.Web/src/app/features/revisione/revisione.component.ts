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
import { EmptyStateComponent } from '../../shared/empty-state.component';

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
  selector: 'app-revisione',
  imports: [FormsModule, RouterLink, ButtonModule, DialogModule, MessageModule, SelectButtonModule, TableModule, TextareaModule, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './revisione.component.html',
  styleUrl: './revisione.component.css',
})
export class RevisioneComponent implements OnInit {
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
