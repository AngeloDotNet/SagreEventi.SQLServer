import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SkeletonModule } from 'primeng/skeleton';
import { EventiStore } from '../../core/eventi-store.service';
import { statoEvento } from '../../core/evento-utils';
import { EmptyState } from '../../shared/empty-state';
import { EventoCard } from '../../shared/evento-card';
import { Festone } from '../../shared/festone';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, SkeletonModule, EmptyState, EventoCard, Festone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero">
      <div class="container">
        <h1 class="hero-titolo">Sagre e feste enogastronomiche.</h1>
        <p class="hero-testo">{{ riepilogo() }}</p>
        <div class="hero-azioni">
          <a routerLink="/eventi" class="btn btn-primario btn-grande">Guarda tutti gli eventi</a>
          <a routerLink="/eventi/nuovo" class="btn btn-contorno btn-grande">Segnala un evento</a>
        </div>
      </div>

      @if (prossimi().length > 0) {
        <div class="hero-festone"><app-festone [eventi]="prossimi()" /></div>
      }
    </section>

    <section class="container sezione">
      <div class="sezione-testa">
        <h2>In corso e in arrivo</h2>
        @if (inProgramma().length > 6) {
          <a routerLink="/eventi" class="link-forte">Vedi tutti i {{ inProgramma().length }} eventi</a>
        }
      </div>

      @if (store.sincronizzando() && store.eventi().length === 0) {
        <div class="griglia-eventi">
          @for (n of scheletri; track n) {
            <p-skeleton height="21rem" borderRadius="18px" />
          }
        </div>
      } @else if (inProgramma().length === 0) {
        <app-empty-state
          icona="🎪"
          titolo="Nessun evento in programma"
          testo="Qui compaiono le sagre in corso e quelle dei prossimi giorni. Conosci una festa che manca? Segnalala: ci vogliono un minuto."
        >
          <a routerLink="/eventi/nuovo" class="btn btn-primario">Segnala un evento</a>
        </app-empty-state>
      } @else {
        <div class="griglia-eventi">
          @for (e of inProgramma().slice(0, 6); track e.id) {
            <app-evento-card [evento]="e" />
          }
        </div>
      }
    </section>

    <section class="container sezione sezione-tre">
      <article>
        <h3>Cerca</h3>
        <p>Filtra per città, per periodo o per parola chiave: «tartufo», «vendemmia», «porchetta».</p>
      </article>
      <article>
        <h3>Segnala</h3>
        <p>Hai trovato una sagra che non c'è? Aggiungila con date e descrizione. Non serve registrarsi.</p>
      </article>
      <article>
        <h3>Usala anche offline</h3>
        <p>Gli eventi restano sul tuo telefono. Le modifiche partono da sole quando torni online.</p>
      </article>
    </section>
  `,
})
export class HomePage {
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
