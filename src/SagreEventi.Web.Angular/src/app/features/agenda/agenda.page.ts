import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EventiStore } from '../../core/eventi-store.service';
import {
  formatMeseAnno,
  formatPeriodo,
  giornoMese,
  parseLocalDate,
  statoEvento,
  statoLabel,
  visualEvento,
} from '../../core/evento-utils';
import { EventoLocale } from '../../core/models';
import { EmptyState } from '../../shared/empty-state';

interface GruppoMese {
  chiave: string;
  etichetta: string;
  eventi: EventoLocale[];
}

@Component({
  selector: 'app-agenda-page',
  imports: [RouterLink, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container pagina pagina-stretta">
      <header class="pagina-testa">
        <h1>Agenda</h1>
        <a routerLink="/eventi/nuovo" class="btn btn-primario"><i class="pi pi-plus" aria-hidden="true"></i>Segnala un evento</a>
      </header>
      <p class="pagina-intro">Gli eventi in corso e in arrivo, mese per mese.</p>

      @if (gruppi().length === 0) {
        <app-empty-state
          icona="🗓️"
          titolo="L'agenda è vuota"
          testo="Non ci sono eventi in corso o in arrivo. Quando ne segnali uno, compare qui nel mese giusto."
        >
          <a routerLink="/eventi/nuovo" class="btn btn-primario">Segnala un evento</a>
        </app-empty-state>
      } @else {
        @for (g of gruppi(); track g.chiave) {
          <section class="agenda-mese" [attr.aria-labelledby]="'m-' + g.chiave">
            <h2 [id]="'m-' + g.chiave">{{ g.etichetta }}</h2>
            <ol class="agenda-lista">
              @for (e of g.eventi; track e.id) {
                <li>
                  <a class="agenda-voce" [routerLink]="['/eventi', e.id]">
                    <span class="agenda-data" [style.background]="gradiente(e)">
                      <strong>{{ data(e).giorno }}</strong>
                      <span>{{ data(e).mese }}</span>
                    </span>
                    <span class="agenda-testo">
                      <span class="agenda-nome">{{ e.nomeEvento }}</span>
                      <span class="agenda-meta">{{ e.cittaEvento }}, {{ periodo(e) }}</span>
                    </span>
                    <span class="agenda-stato" [class.is-live]="inCorso(e)">{{ etichetta(e) }}</span>
                  </a>
                </li>
              }
            </ol>
          </section>
        }
      }
    </div>
  `,
})
export class AgendaPage {
  private readonly store = inject(EventiStore);

  protected readonly gruppi = computed<GruppoMese[]>(() => {
    const mappa = new Map<string, GruppoMese>();
    for (const e of this.store.eventi()) {
      if (statoEvento(e) === 'terminato') continue;
      const inizio = parseLocalDate(e.dataInizioEvento);
      // Un evento già iniziato compare nel mese corrente, non in quello di partenza.
      const riferimento = statoEvento(e) === 'in-corso' ? new Date() : inizio;
      const chiave = `${riferimento.getFullYear()}-${String(riferimento.getMonth() + 1).padStart(2, '0')}`;
      let g = mappa.get(chiave);
      if (!g) {
        const etichetta = formatMeseAnno(riferimento);
        g = { chiave, etichetta: etichetta.charAt(0).toUpperCase() + etichetta.slice(1), eventi: [] };
        mappa.set(chiave, g);
      }
      g.eventi.push(e);
    }
    return [...mappa.values()].sort((a, b) => a.chiave.localeCompare(b.chiave));
  });

  protected data(e: EventoLocale): { giorno: string; mese: string } {
    return giornoMese(e.dataInizioEvento);
  }
  protected periodo(e: EventoLocale): string {
    return formatPeriodo(e);
  }
  protected gradiente(e: EventoLocale): string {
    return visualEvento(e).gradient;
  }
  protected inCorso(e: EventoLocale): boolean {
    return statoEvento(e) === 'in-corso';
  }
  protected etichetta(e: EventoLocale): string {
    return statoLabel(e);
  }
}
