import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TagModule } from 'primeng/tag';
import { formatPeriodo, statoLabel, statoSeverity, visualEvento } from '../core/evento-utils';
import { EventoLocale } from '../core/models';

@Component({
  selector: 'app-evento-card',
  imports: [RouterLink, TagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './evento-card.component.html',
})
export class EventoCardComponent {
  readonly evento = input.required<EventoLocale>();
  readonly layout = input<'grid' | 'list'>('grid');

  protected readonly visual = computed(() => visualEvento(this.evento()));
  protected readonly label = computed(() => statoLabel(this.evento()));
  protected readonly severity = computed(() => statoSeverity(this.evento()));
  protected readonly periodo = computed(() => formatPeriodo(this.evento()));
}
