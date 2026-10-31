import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { EventiStore } from '../../../core/eventi-store.service';
import { normalizzaTesto, parseLocalDate, statoEvento } from '../../../core/evento-utils';
import { EmptyStateComponent } from '../../../shared/empty-state.component';
import { EventoCardComponent } from '../../../shared/evento-card.component';

type Periodo = 'programma' | 'in-corso' | 'in-arrivo' | 'tutti';
type Ordine = 'data' | 'nome' | 'citta';
type Vista = 'grid' | 'list';

@Component({
  selector: 'app-eventi-list',
  imports: [
    FormsModule,
    ButtonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    SelectModule,
    SkeletonModule,
    EmptyStateComponent,
    EventoCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './eventi-list.component.html',
})
export class EventiListComponent {
  protected readonly store = inject(EventiStore);
  protected readonly scheletri = [1, 2, 3, 4, 5, 6];

  protected readonly query = signal('');
  protected readonly citta = signal<string | null>(null);
  protected readonly periodo = signal<Periodo>('programma');
  protected readonly ordine = signal<Ordine>('data');
  protected readonly vista = signal<Vista>('grid');

  protected readonly opzioniPeriodo: { label: string; value: Periodo }[] = [
    { label: 'In programma', value: 'programma' },
    { label: 'In corso', value: 'in-corso' },
    { label: 'In arrivo', value: 'in-arrivo' },
    { label: 'Anche terminati', value: 'tutti' },
  ];

  protected readonly opzioniOrdine: { label: string; value: Ordine }[] = [
    { label: 'Data di inizio', value: 'data' },
    { label: 'Nome', value: 'nome' },
    { label: 'Città', value: 'citta' },
  ];

  protected readonly filtriAttivi = computed(
    () => this.query().trim() !== '' || this.citta() !== null || this.periodo() !== 'programma',
  );

  protected readonly risultati = computed(() => {
    const q = normalizzaTesto(this.query().trim());
    const citta = this.citta();
    const periodo = this.periodo();

    const lista = this.store.eventi().filter((e) => {
      const stato = statoEvento(e);
      if (periodo === 'programma' && stato === 'terminato') return false;
      if (periodo === 'in-corso' && stato !== 'in-corso') return false;
      if (periodo === 'in-arrivo' && stato !== 'in-arrivo') return false;
      if (citta && e.cittaEvento.trim() !== citta) return false;
      if (q && !normalizzaTesto(`${e.nomeEvento} ${e.cittaEvento} ${e.descrizioneEvento}`).includes(q)) return false;
      return true;
    });

    switch (this.ordine()) {
      case 'nome':
        return lista.sort((a, b) => a.nomeEvento.localeCompare(b.nomeEvento, 'it'));
      case 'citta':
        return lista.sort((a, b) => a.cittaEvento.localeCompare(b.cittaEvento, 'it'));
      default:
        return lista.sort(
          (a, b) => parseLocalDate(a.dataInizioEvento).getTime() - parseLocalDate(b.dataInizioEvento).getTime(),
        );
    }
  });

  protected azzera(): void {
    this.query.set('');
    this.citta.set(null);
    this.periodo.set('programma');
  }
}
