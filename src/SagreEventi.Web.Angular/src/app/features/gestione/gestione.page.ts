import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PermessiService } from '../../core/permessi.service';
import { RevisioneService } from '../../core/revisione.service';

/** Contenitore di Revisione e Utenti: una sola voce di menu, le sezioni sono schede. Gli Editor vedono solo la Revisione. */
@Component({
  selector: 'app-gestione-page',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .schede {
      display: flex;
      gap: 0.25rem;
      padding-top: 1rem;
    }
  `,
  template: `
    <div class="container">
      <nav class="schede" aria-label="Gestione">
        <a routerLink="revisione" routerLinkActive="attivo" class="nav-link">
          <i class="pi pi-check-square" aria-hidden="true"></i>{{ etichettaRevisione() }}
        </a>
        @if (permessi.eAdmin()) {
          <a routerLink="utenti" routerLinkActive="attivo" class="nav-link">
            <i class="pi pi-users" aria-hidden="true"></i>Utenti
          </a>
        }
      </nav>
    </div>
    <router-outlet />
  `,
})
export class GestionePage {
  protected readonly permessi = inject(PermessiService);
  private readonly revisione = inject(RevisioneService);

  protected etichettaRevisione(): string {
    const n = this.revisione.inAttesa();
    return n ? `Revisione (${n})` : 'Revisione';
  }
}
