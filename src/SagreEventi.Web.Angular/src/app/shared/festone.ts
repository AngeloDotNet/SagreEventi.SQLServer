import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatPeriodo, giornoMese, visualEvento } from '../core/evento-utils';
import { EventoLocale } from '../core/models';

/** Il festone di bandierine delle sagre: ogni bandierina è un evento reale. */
@Component({
  selector: 'app-festone',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="festone" role="list" aria-label="Prossimi eventi">
      <div class="festone-corda" aria-hidden="true"></div>
      @for (e of eventi(); track e.id; let i = $index) {
        <a
          role="listitem"
          class="bandierina"
          [attr.data-c]="i % 4"
          [style.--i]="i"
          [routerLink]="['/eventi', e.id]"
          [attr.title]="e.nomeEvento + ' – ' + e.cittaEvento"
          [attr.aria-label]="e.nomeEvento + ', ' + e.cittaEvento + ', ' + periodo(e)"
        >
          <span class="bandierina-data">
            <strong>{{ data(e).giorno }}</strong>
            <span>{{ data(e).mese }}</span>
          </span>
          <span class="bandierina-emoji" aria-hidden="true">{{ emoji(e) }}</span>
        </a>
      }
    </div>
  `,
})
export class Festone {
  readonly eventi = input.required<EventoLocale[]>();

  protected data(e: EventoLocale): { giorno: string; mese: string } {
    return giornoMese(e.dataInizioEvento);
  }
  protected emoji(e: EventoLocale): string {
    return visualEvento(e).emoji;
  }
  protected periodo(e: EventoLocale): string {
    return formatPeriodo(e);
  }
}
