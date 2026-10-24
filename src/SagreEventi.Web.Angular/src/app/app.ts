import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { AuthService } from './core/auth.service';
import { EventiStore } from './core/eventi-store.service';
import { PermessiService } from './core/permessi.service';
import { RevisioneService } from './core/revisione.service';
import { ThemeService } from './core/theme.service';
import { SyncStatus } from './shared/sync-status';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonModule, ToastModule, ConfirmDialogModule, SyncStatus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip" href="#contenuto">Vai al contenuto</a>

    <header class="topbar">
      <div class="container topbar-inner">
        <a routerLink="/" class="brand" aria-label="Sagre e Eventi, home">
          <svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
            <path d="M3 9h34" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" />
            <path d="M5 10h10l-5 17z" fill="#f5a524" />
            <path d="M15 10h10l-5 17z" fill="currentColor" />
            <path d="M25 10h10l-5 17z" fill="#2f7d4f" />
          </svg>
          <span class="brand-nome">Sagre &amp; Eventi</span>
        </a>

        <nav class="nav-desktop" aria-label="Principale">
          @for (l of link(); track l.path) {
            <a [routerLink]="l.path" routerLinkActive="attivo" [routerLinkActiveOptions]="{ exact: l.esatto }" class="nav-link">
              <i [class]="'pi ' + l.icona" aria-hidden="true"></i>{{ l.etichetta }}
            </a>
          }
        </nav>

        <div class="topbar-azioni">
          <app-sync-status />
          <p-button
            [icon]="theme.scuro() ? 'pi pi-sun' : 'pi pi-moon'"
            [rounded]="true"
            [text]="true"
            severity="secondary"
            [ariaLabel]="theme.scuro() ? 'Passa al tema chiaro' : 'Passa al tema scuro'"
            (onClick)="theme.alterna()"
          />
          @if (auth.autenticato()) {
            <p-button
              icon="pi pi-sign-out"
              [rounded]="true"
              [text]="true"
              severity="secondary"
              [ariaLabel]="'Esci (' + auth.email() + ')'"
              (onClick)="esci()"
            />
          } @else {
            <a routerLink="/login" class="btn btn-testo" aria-label="Accedi"><i class="pi pi-sign-in" aria-hidden="true"></i>Accedi</a>
          }
          <a routerLink="/eventi/nuovo" class="btn btn-primario cta-desktop"><i class="pi pi-plus" aria-hidden="true"></i>Segnala</a>
        </div>
      </div>
    </header>

    <main id="contenuto">
      <router-outlet />
    </main>

    <footer class="footer">
      <div class="container footer-inner">
        <p>
          Sagre &amp; Eventi tiene traccia di feste e festival enogastronomici segnalati dagli utenti.
          Gli eventi sono salvati sul tuo dispositivo e si sincronizzano con il server.
        </p>
        <p>
          Open source con licenza MIT.
          <a href="https://github.com/AngeloDotNet/SagreEventi.SQLServer" target="_blank" rel="noopener">Codice sorgente</a>
        </p>
      </div>
    </footer>

    <nav class="nav-mobile" aria-label="Principale">
      @for (l of link(); track l.path) {
        <a [routerLink]="l.path" routerLinkActive="attivo" [routerLinkActiveOptions]="{ exact: l.esatto }">
          <i [class]="'pi ' + l.icona" aria-hidden="true"></i><span>{{ l.etichetta }}</span>
        </a>
      }
      <a routerLink="/eventi/nuovo" routerLinkActive="attivo" class="nav-mobile-plus">
        <i class="pi pi-plus" aria-hidden="true"></i><span>Segnala</span>
      </a>
    </nav>

    <p-toast position="bottom-right" />
    <p-confirmdialog />
  `,
})
export class App {
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);
  protected readonly store = inject(EventiStore);
  private readonly router = inject(Router);
  private readonly permessi = inject(PermessiService);
  private readonly revisione = inject(RevisioneService);

  protected readonly link = computed(() => [
    { path: '/', etichetta: 'Home', icona: 'pi-home', esatto: true },
    { path: '/eventi', etichetta: 'Eventi', icona: 'pi-th-large', esatto: false },
    { path: '/agenda', etichetta: 'Agenda', icona: 'pi-calendar', esatto: false },
    ...(this.store.mieSegnalazioni().length > 0
      ? [{ path: '/segnalazioni', etichetta: 'Le mie', icona: 'pi-inbox', esatto: false }]
      : []),
    ...(this.permessi.modificaConsentita()
      ? [{ path: '/gestione', etichetta: this.etichettaGestione(), icona: 'pi-cog', esatto: false }]
      : []),
  ]);

  constructor() {
    if (this.store.online()) void this.store.sincronizza();

    // Contatore delle segnalazioni da rivedere: solo per chi può revisionare e solo online
    effect(() => {
      const abilitato = this.permessi.modificaConsentita();
      const online = this.store.online();
      untracked(() => {
        if (!abilitato) this.revisione.azzera();
        else if (online) void this.revisione.aggiornaConteggio();
      });
    });
  }

  private etichettaGestione(): string {
    const n = this.revisione.inAttesa();
    return n ? `Gestione (${n})` : 'Gestione';
  }

  protected esci(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/');
  }
}
