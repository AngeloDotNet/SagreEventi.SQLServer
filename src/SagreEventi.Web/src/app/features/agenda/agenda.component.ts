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
import { EmptyStateComponent } from '../../shared/empty-state.component';

interface GruppoMese {
  chiave: string;
  etichetta: string;
  eventi: EventoLocale[];
}

@Component({
  selector: 'app-agenda',
  imports: [RouterLink, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agenda.component.html',
})
export class AgendaComponent {
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
