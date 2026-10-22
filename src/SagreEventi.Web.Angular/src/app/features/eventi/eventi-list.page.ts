import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { EventiStore } from '../../core/eventi-store.service';
import { normalizzaTesto, parseLocalDate, statoEvento } from '../../core/evento-utils';
import { EmptyState } from '../../shared/empty-state';
import { EventoCard } from '../../shared/evento-card';

type Periodo = 'programma' | 'in-corso' | 'in-arrivo' | 'tutti';
type Ordine = 'data' | 'nome' | 'citta';
type Vista = 'grid' | 'list';

@Component({
  selector: 'app-eventi-list-page',
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    SelectModule,
    SelectButtonModule,
    SkeletonModule,
    EmptyState,
    EventoCard,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container pagina">
      <header class="pagina-testa">
        <h1>Tutti gli eventi</h1>
        <a routerLink="/eventi/nuovo" class="btn btn-primario"><i class="pi pi-plus" aria-hidden="true"></i>Segnala un evento</a>
      </header>

      <section class="filtri" aria-label="Filtri">
        <p-iconfield class="filtri-cerca">
          <p-inputicon class="pi pi-search" />
          <input
            pInputText
            type="search"
            placeholder="Cerca per nome, città o descrizione"
            aria-label="Cerca eventi"
            [ngModel]="query()"
            (ngModelChange)="query.set($event ?? '')"
          />
        </p-iconfield>

        <p-select
          class="filtri-citta"
          [options]="store.citta()"
          [ngModel]="citta()"
          (ngModelChange)="citta.set($event ?? null)"
          placeholder="Tutte le città"
          [showClear]="true"
          [filter]="store.citta().length > 8"
          ariaLabel="Filtra per città"
        />

        <p-select
          class="filtri-ordine"
          [options]="opzioniOrdine"
          optionLabel="label"
          optionValue="value"
          [ngModel]="ordine()"
          (ngModelChange)="ordine.set($event)"
          ariaLabel="Ordina per"
        />

        <p-selectbutton
          class="filtri-periodo"
          [options]="opzioniPeriodo"
          optionLabel="label"
          optionValue="value"
          [allowEmpty]="false"
          [ngModel]="periodo()"
          (ngModelChange)="periodo.set($event)"
        />

        <div class="filtri-vista" role="group" aria-label="Vista">
          <p-button
            icon="pi pi-th-large"
            [rounded]="true"
            [text]="vista() !== 'grid'"
            severity="secondary"
            ariaLabel="Vista a griglia"
            (onClick)="vista.set('grid')"
          />
          <p-button
            icon="pi pi-list"
            [rounded]="true"
            [text]="vista() !== 'list'"
            severity="secondary"
            ariaLabel="Vista a elenco"
            (onClick)="vista.set('list')"
          />
        </div>
      </section>

      <p class="risultati" aria-live="polite">
        {{ risultati().length === 1 ? '1 evento' : risultati().length + ' eventi' }}
        @if (filtriAttivi()) {
          <button type="button" class="link-forte link-bottone" (click)="azzera()">Azzera i filtri</button>
        }
      </p>

      @if (store.sincronizzando() && store.eventi().length === 0) {
        <div class="griglia-eventi">
          @for (n of scheletri; track n) {
            <p-skeleton height="21rem" borderRadius="18px" />
          }
        </div>
      } @else if (store.eventi().length === 0) {
        <app-empty-state
          icona="🎪"
          titolo="Ancora nessun evento"
          testo="L'elenco è vuoto. Sincronizza per scaricare gli eventi dal server, oppure segnala il primo."
        >
          <a routerLink="/eventi/nuovo" class="btn btn-primario">Segnala un evento</a>
        </app-empty-state>
      } @else if (risultati().length === 0) {
        <app-empty-state
          icona="🔎"
          titolo="Nessun evento corrisponde ai filtri"
          testo="Prova con un'altra parola, scegli un'altra città oppure includi anche gli eventi terminati."
        >
          <button type="button" class="btn btn-contorno" (click)="azzera()">Azzera i filtri</button>
        </app-empty-state>
      } @else {
        <div class="griglia-eventi" [class.is-list]="vista() === 'list'">
          @for (e of risultati(); track e.id) {
            <app-evento-card [evento]="e" [layout]="vista()" />
          }
        </div>
      }
    </div>
  `,
})
export class EventiListPage {
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
