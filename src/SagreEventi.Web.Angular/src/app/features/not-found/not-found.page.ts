import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyState } from '../../shared/empty-state';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container pagina">
      <app-empty-state icona="🧭" titolo="Pagina non trovata" testo="L'indirizzo non corrisponde a nessuna pagina di Sagre & Eventi.">
        <a routerLink="/" class="btn btn-primario">Torna alla home</a>
      </app-empty-state>
    </div>
  `,
})
export class NotFoundPage {}
