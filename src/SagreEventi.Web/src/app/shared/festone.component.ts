import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatPeriodo, giornoMese, visualEvento } from '../core/evento-utils';
import { EventoLocale } from '../core/models';

/** Il festone di bandierine delle sagre: ogni bandierina è un evento reale. */
@Component({
  selector: 'app-festone',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './festone.component.html',
})
export class FestoneComponent {
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
