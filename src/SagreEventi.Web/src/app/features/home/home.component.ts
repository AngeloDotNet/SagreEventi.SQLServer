import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SkeletonModule } from 'primeng/skeleton';
import { EventiStore } from '../../core/eventi-store.service';
import { statoEvento } from '../../core/evento-utils';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { EventoCardComponent } from '../../shared/evento-card.component';
import { FestoneComponent } from '../../shared/festone.component';

@Component({
  selector: 'app-home',
  imports: [RouterLink, SkeletonModule, EmptyStateComponent, EventoCardComponent, FestoneComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
})
export class HomeComponent {
  protected readonly store = inject(EventiStore);
  protected readonly scheletri = [1, 2, 3];

  /** In corso prima, poi in arrivo; esclude gli eventi già finiti. */
  protected readonly inProgramma = computed(() =>
    this.store
      .eventi()
      .filter((e) => statoEvento(e) !== 'terminato')
      .sort((a, b) => Number(statoEvento(a) !== 'in-corso') - Number(statoEvento(b) !== 'in-corso')),
  );

  protected readonly prossimi = computed(() => this.inProgramma().slice(0, 8));

  protected readonly riepilogo = computed(() => {
    const lista = this.inProgramma();
    if (lista.length === 0) return 'Nessun evento in programma al momento. Sii il primo a segnalarne uno.';
    const citta = new Set(lista.map((e) => e.cittaEvento.trim().toLowerCase())).size;
    const inCorso = lista.filter((e) => statoEvento(e) === 'in-corso').length;
    const eventi = lista.length === 1 ? '1 evento in programma' : `${lista.length} eventi in programma`;
    const luoghi = citta === 1 ? 'in 1 città' : `in ${citta} città`;
    const oggi = inCorso === 0 ? '' : inCorso === 1 ? ', 1 è in corso adesso' : `, ${inCorso} sono in corso adesso`;
    return `${eventi} ${luoghi}${oggi}.`;
  });
}
