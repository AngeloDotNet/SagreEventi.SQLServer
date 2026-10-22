import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TagModule } from 'primeng/tag';
import { formatPeriodo, statoLabel, statoSeverity, visualEvento } from '../core/evento-utils';
import { EventoLocale } from '../core/models';

@Component({
  selector: 'app-evento-card',
  imports: [RouterLink, TagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="ev-card" [class.is-list]="layout() === 'list'" [routerLink]="['/eventi', evento().id]">
      <div class="ev-cover" [style.background]="visual().gradient" aria-hidden="true">
        <span class="ev-emoji">{{ visual().emoji }}</span>
      </div>
      <div class="ev-body">
        <div class="ev-top">
          <p-tag [value]="label()" [severity]="severity()" [rounded]="true" />
          @if (evento().dirty) {
            <span class="ev-pending"><i class="pi pi-cloud-upload" aria-hidden="true"></i> Da inviare</span>
          }
        </div>
        <h3 class="ev-title">{{ evento().nomeEvento }}</h3>
        <p class="ev-meta"><i class="pi pi-map-marker" aria-hidden="true"></i>{{ evento().cittaEvento }}</p>
        <p class="ev-meta"><i class="pi pi-calendar" aria-hidden="true"></i>{{ periodo() }}</p>
        <p class="ev-desc">{{ evento().descrizioneEvento }}</p>
      </div>
    </a>
  `,
})
export class EventoCard {
  readonly evento = input.required<EventoLocale>();
  readonly layout = input<'grid' | 'list'>('grid');

  protected readonly visual = computed(() => visualEvento(this.evento()));
  protected readonly label = computed(() => statoLabel(this.evento()));
  protected readonly severity = computed(() => statoSeverity(this.evento()));
  protected readonly periodo = computed(() => formatPeriodo(this.evento()));
}
