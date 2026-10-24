import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';
import { EventiStore } from '../../core/eventi-store.service';
import { parseLocalDate, startOfToday, toDateOnlyIso } from '../../core/evento-utils';
import { EventoDraft } from '../../core/models';
import { PermessiService } from '../../core/permessi.service';
import { EmptyState } from '../../shared/empty-state';

type CampoForm = 'nomeEvento' | 'cittaEvento' | 'dataInizioEvento' | 'dataFineEvento' | 'descrizioneEvento';

/** La fine non può precedere l'inizio. */
const intervalloDate: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const inizio = c.get('dataInizioEvento')?.value as Date | null;
  const fine = c.get('dataFineEvento')?.value as Date | null;
  return inizio && fine && fine.getTime() < inizio.getTime() ? { intervallo: true } : null;
};

@Component({
  selector: 'app-evento-form-page',
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, DatePickerModule, InputTextModule, MessageModule, TextareaModule, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container pagina pagina-stretta">
      @if (nonTrovato()) {
        <app-empty-state
          icona="🧭"
          titolo="Evento non trovato"
          testo="Non posso modificare un evento che non è su questo dispositivo. Sincronizza e riprova."
        >
          <a routerLink="/eventi" class="btn btn-primario">Vai a tutti gli eventi</a>
        </app-empty-state>
      } @else {
        <a [routerLink]="id() ? ['/eventi', id()] : '/eventi'" class="indietro indietro-scuro">
          <i class="pi pi-arrow-left" aria-hidden="true"></i>Indietro
        </a>
        <h1>{{ id() ? 'Modifica evento' : 'Segnala un evento' }}</h1>
        <p class="pagina-intro">
          {{ id() ? 'Correggi i dati: la versione più recente sostituisce quella sul server.' : 'Compila i dati della sagra o del festival. Tutti i campi sono obbligatori.' }}
        </p>

        <form class="form" [formGroup]="form" (ngSubmit)="salva()" novalidate>
          <div class="campo">
            <label for="nome">Nome dell'evento</label>
            <input pInputText id="nome" formControlName="nomeEvento" maxlength="200" autocomplete="off" placeholder="Sagra della castagna di Soriano" />
            @if (errore('nomeEvento'); as m) {
              <p-message severity="error" variant="simple" size="small">{{ m }}</p-message>
            }
          </div>

          <div class="campo">
            <label for="citta">Città</label>
            <input pInputText id="citta" formControlName="cittaEvento" maxlength="100" autocomplete="off" list="elenco-citta" placeholder="Soriano nel Cimino" />
            <datalist id="elenco-citta">
              @for (c of store.citta(); track c) {
                <option [value]="c"></option>
              }
            </datalist>
            @if (errore('cittaEvento'); as m) {
              <p-message severity="error" variant="simple" size="small">{{ m }}</p-message>
            }
          </div>

          <div class="campo-coppia">
            <div class="campo">
              <label for="inizio">Primo giorno</label>
              <p-datepicker inputId="inizio" formControlName="dataInizioEvento" dateFormat="dd/mm/yy" [showIcon]="true" iconDisplay="input" [showButtonBar]="true" placeholder="gg/mm/aaaa" />
              @if (errore('dataInizioEvento'); as m) {
                <p-message severity="error" variant="simple" size="small">{{ m }}</p-message>
              }
            </div>
            <div class="campo">
              <label for="fine">Ultimo giorno</label>
              <p-datepicker inputId="fine" formControlName="dataFineEvento" dateFormat="dd/mm/yy" [showIcon]="true" iconDisplay="input" [showButtonBar]="true" [minDate]="inizio()" placeholder="gg/mm/aaaa" />
              @if (errore('dataFineEvento'); as m) {
                <p-message severity="error" variant="simple" size="small">{{ m }}</p-message>
              }
            </div>
          </div>
          @if (form.touched && form.hasError('intervallo')) {
            <p-message severity="error" variant="simple" size="small">L'ultimo giorno non può essere prima del primo.</p-message>
          }

          <div class="campo">
            <label for="descrizione">Descrizione</label>
            <textarea pTextarea id="descrizione" formControlName="descrizioneEvento" rows="7" maxlength="4000" placeholder="Cosa si mangia, che programma c'è, dove parcheggiare…"></textarea>
            <small class="contatore">{{ form.controls.descrizioneEvento.value.length }} / 4000</small>
            @if (errore('descrizioneEvento'); as m) {
              <p-message severity="error" variant="simple" size="small">{{ m }}</p-message>
            }
          </div>

          <div class="form-azioni">
            <p-button type="submit" [label]="id() ? 'Salva le modifiche' : 'Segnala l\\'evento'" icon="pi pi-check" />
            <a [routerLink]="id() ? ['/eventi', id()] : '/eventi'" class="btn btn-testo">Annulla</a>
          </div>
        </form>
      }
    </div>
  `,
})
export class EventoFormPage implements OnInit {
  /** Presente solo nella rotta di modifica (`eventi/:id/modifica`). */
  readonly id = input<string>();

  protected readonly store = inject(EventiStore);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly messaggi = inject(MessageService);
  private readonly permessi = inject(PermessiService);

  protected readonly nonTrovato = signal(false);

  protected readonly form = this.fb.group(
    {
      nomeEvento: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(200)]],
      cittaEvento: ['', [Validators.required, Validators.maxLength(100)]],
      dataInizioEvento: this.fb.control<Date | null>(null, Validators.required),
      dataFineEvento: this.fb.control<Date | null>(null, Validators.required),
      descrizioneEvento: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(4000)]],
    },
    { validators: [intervalloDate] },
  );

  private readonly inizioValore = toSignal(this.form.controls.dataInizioEvento.valueChanges, {
    initialValue: this.form.controls.dataInizioEvento.value,
  });
  protected readonly inizio = computed(() => this.inizioValore() ?? startOfToday());

  ngOnInit(): void {
    const id = this.id();
    if (!id) return;
    const e = this.store.trova(id);
    if (!e) {
      this.nonTrovato.set(true);
      return;
    }
    this.form.patchValue({
      nomeEvento: e.nomeEvento,
      cittaEvento: e.cittaEvento,
      dataInizioEvento: parseLocalDate(e.dataInizioEvento),
      dataFineEvento: parseLocalDate(e.dataFineEvento),
      descrizioneEvento: e.descrizioneEvento,
    });
  }

  /** Messaggio di errore del campo. */
  protected errore(nome: CampoForm): string | null {
    const c = this.form.controls[nome];
    if (!c.invalid || !(c.touched || c.dirty)) return null;
    if (c.hasError('required')) {
      return {
        nomeEvento: 'Il nome dell\'evento è obbligatorio.',
        cittaEvento: 'La città è obbligatoria.',
        dataInizioEvento: 'Indica il primo giorno.',
        dataFineEvento: 'Indica l\'ultimo giorno.',
        descrizioneEvento: 'La descrizione è obbligatoria.',
      }[nome];
    }
    const min = c.getError('minlength') as { requiredLength: number } | null;
    if (min) return `Servono almeno ${min.requiredLength} caratteri.`;
    const max = c.getError('maxlength') as { requiredLength: number } | null;
    if (max) return `Al massimo ${max.requiredLength} caratteri.`;
    return null;
  }

  protected salva(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const v = this.form.getRawValue();
    if (!v.dataInizioEvento || !v.dataFineEvento) return;

    const draft: EventoDraft = {
      nomeEvento: v.nomeEvento.trim(),
      cittaEvento: v.cittaEvento.trim(),
      dataInizioEvento: toDateOnlyIso(v.dataInizioEvento),
      dataFineEvento: toDateOnlyIso(v.dataFineEvento),
      descrizioneEvento: v.descrizioneEvento.trim(),
    };

    const id = this.id();
    let destinazione: string;
    if (id) {
      this.store.aggiorna(id, draft);
      destinazione = id;
    } else {
      destinazione = this.store.crea(draft).id;
    }

    const inRevisione = !id && !this.permessi.puoModificare();
    this.messaggi.add({
      severity: 'success',
      summary: id ? 'Modifiche salvate' : inRevisione ? 'Segnalazione ricevuta' : 'Evento segnalato',
      detail: inRevisione
        ? 'Sarà visibile a tutti dopo la revisione. Lo trovi in «Le mie segnalazioni».'
        : this.store.online() ? 'Lo sto inviando al server.' : 'Sei offline: partirà appena torni online.',
      life: inRevisione ? 7000 : 4000,
    });
    void this.store.sincronizza();
    void this.router.navigate(['/eventi', destinazione]);
  }
}
