import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TagModule } from 'primeng/tag';
import { EventiStore } from '../../core/eventi-store.service';
import { formatPeriodo } from '../../core/evento-utils';
import { EmptyStateComponent } from '../../shared/empty-state.component';

/** Segnalazioni fatte da questo dispositivo che non sono ancora pubbliche. Un eventuale rifiuto non è comunicato: restano "in attesa". */
@Component({
  selector: 'app-mie-segnalazioni',
  imports: [RouterLink, TagModule, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mie-segnalazioni.component.html',
  styleUrl: './mie-segnalazioni.component.css',
})
export class MieSegnalazioniComponent {
  protected readonly store = inject(EventiStore);

  protected periodo = formatPeriodo;
}
