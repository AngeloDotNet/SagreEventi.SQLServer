import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PermessiService } from '../../core/permessi.service';
import { RevisioneService } from '../../core/revisione.service';

/** Contenitore di Revisione e Utenti: una sola voce di menu, le sezioni sono schede. Gli Editor vedono solo la Revisione. */
@Component({
  selector: 'app-gestione',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './gestione.component.css',
  templateUrl: './gestione.component.html',
})
export class GestioneComponent {
  protected readonly permessi = inject(PermessiService);
  private readonly revisione = inject(RevisioneService);

  protected etichettaRevisione(): string {
    const n = this.revisione.inAttesa();
    return n ? `Revisione (${n})` : 'Revisione';
  }
}
