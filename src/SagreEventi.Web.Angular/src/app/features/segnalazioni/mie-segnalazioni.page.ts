import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TagModule } from 'primeng/tag';
import { EventiStore } from '../../core/eventi-store.service';
import { formatPeriodo } from '../../core/evento-utils';
import { EmptyState } from '../../shared/empty-state';

/** Segnalazioni fatte da questo dispositivo che non sono ancora pubbliche. Un eventuale rifiuto non è comunicato: restano "in attesa". */
@Component({
  selector: 'app-mie-segnalazioni-page',
  imports: [RouterLink, TagModule, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container pagina pagina-stretta">
      <h1>Le mie segnalazioni</h1>
      <p class="pagina-intro">
        Un evento segnalato diventa visibile a tutti dopo la revisione. Finché non è approvato lo vedi solo su questo dispositivo.
      </p>

      @if (store.mieSegnalazioni().length === 0) {
        <app-empty-state icona="📬" titolo="Nessuna segnalazione in sospeso" testo="Le tue segnalazioni approvate compaiono tra gli eventi.">
          <a routerLink="/eventi" class="btn btn-primario">Vai agli eventi</a>
        </app-empty-state>
      } @else {
        <ul class="elenco-segnalazioni">
          @for (e of store.mieSegnalazioni(); track e.id) {
            <li class="segnalazione">
              <div class="ev-top">
                <p-tag value="In attesa di approvazione" severity="warn" [rounded]="true" />
                @if (e.dirty) {
                  <span class="ev-pending"><i class="pi pi-cloud-upload" aria-hidden="true"></i> Da inviare al server</span>
                }
              </div>
              <h2>
                <a [routerLink]="['/eventi', e.id]">{{ e.nomeEvento }}</a>
              </h2>
              <p>{{ e.cittaEvento }} · {{ periodo(e) }}</p>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .elenco-segnalazioni { list-style: none; margin: 0; padding: 0; display: grid; gap: 1rem; }
    .segnalazione { border: 1px solid var(--line); border-radius: 14px; padding: 1rem 1.2rem; }
    .segnalazione h2 { margin: 0.5rem 0 0.25rem; font-size: 1.2rem; }
    .segnalazione p { margin: 0.25rem 0; }
  `,
})
export class MieSegnalazioniPage {
  protected readonly store = inject(EventiStore);

  protected periodo = formatPeriodo;
}
