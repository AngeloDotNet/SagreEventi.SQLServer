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
import { EventiStore } from '../../../core/eventi-store.service';
import { parseLocalDate, startOfToday, toDateOnlyIso } from '../../../core/evento-utils';
import { EventoDraft } from '../../../core/models';
import { PermessiService } from '../../../core/permessi.service';
import { EmptyStateComponent } from '../../../shared/empty-state.component';

type CampoForm = 'nomeEvento' | 'cittaEvento' | 'dataInizioEvento' | 'dataFineEvento' | 'descrizioneEvento';

/** La fine non può precedere l'inizio. */
const intervalloDate: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const inizio = c.get('dataInizioEvento')?.value as Date | null;
  const fine = c.get('dataFineEvento')?.value as Date | null;
  return inizio && fine && fine.getTime() < inizio.getTime() ? { intervallo: true } : null;
};

@Component({
  selector: 'app-evento-form',
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, DatePickerModule, InputTextModule, MessageModule, TextareaModule, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './evento-form.component.html',
})
export class EventoFormComponent implements OnInit {
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
