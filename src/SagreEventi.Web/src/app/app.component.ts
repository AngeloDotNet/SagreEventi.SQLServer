import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { AuthService } from './core/auth.service';
import { EventiStore } from './core/eventi-store.service';
import { PermessiService } from './core/permessi.service';
import { RevisioneService } from './core/revisione.service';
import { Tema, ThemeService, inStagione } from './core/theme.service';
import { AggiornamentoAppService } from './core/aggiornamento-app.service';
import { ErroreNavigazioneService } from './core/errore-navigazione.service';
import { SyncStatusComponent } from './shared/sync-status.component';

/** Entries of the theme picker. */
const TEMI_MENU: readonly { tema: Tema; etichetta: string; icona: string }[] = [
  { tema: 'light', etichetta: 'Tema chiaro', icona: 'pi pi-sun' },
  { tema: 'dark', etichetta: 'Tema scuro', icona: 'pi pi-moon' },
  { tema: 'pasqua', etichetta: 'Tema Pasqua', icona: 'icona-uovo' },
  { tema: 'ferragosto', etichetta: 'Tema Ferragosto', icona: 'icona-ombrellone' },
  { tema: 'halloween', etichetta: 'Tema Halloween', icona: 'icona-zucca' },
  { tema: 'natale', etichetta: 'Tema Natale chiaro', icona: 'icona-albero' },
  { tema: 'natale-scuro', etichetta: 'Tema Natale scuro', icona: 'icona-albero' },
];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonModule, MenuModule, ToastModule, ConfirmDialogModule, SyncStatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html',
})
export class AppComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);
  protected readonly aggiornamento = inject(AggiornamentoAppService);
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

  /** Entries of the topbar menu: account (login or logout) and the information page. */
  protected readonly voci = computed<MenuItem[]>(() => [
    this.auth.autenticato()
      ? { label: `Esci (${this.auth.email()})`, icon: 'pi pi-sign-out', command: () => this.esci() }
      : { label: 'Accedi', icon: 'pi pi-user', routerLink: '/login' },
    { label: 'Informazioni', icon: 'pi pi-info-circle', routerLink: '/informazioni' },
  ]);

  /** Theme picker entries: the active one is highlighted. */
  protected readonly vociTema = computed<MenuItem[]>(() =>
    TEMI_MENU.filter((t) => inStagione(t.tema)).map((t) => ({
      label: t.etichetta,
      icon: t.icona,
      styleClass: this.theme.tema() === t.tema ? 'voce-attiva' : '',
      command: () => this.theme.imposta(t.tema),
    })),
  );

  /** Icon and name of the current theme, for the picker button. */
  protected readonly temaCorrente = computed(() => TEMI_MENU.find((t) => t.tema === this.theme.tema()) ?? TEMI_MENU[0]);

  constructor() {
    // Starts listening for failed navigations (toast to the user)
    inject(ErroreNavigazioneService);

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
