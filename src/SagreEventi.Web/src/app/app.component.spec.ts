import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AppComponent } from './app.component';
import { AggiornamentoAppService } from './core/aggiornamento-app.service';
import { AuthService } from './core/auth.service';
import { EventiStore } from './core/eventi-store.service';
import { PermessiService } from './core/permessi.service';
import { RevisioneService } from './core/revisione.service';
import { ThemeService } from './core/theme.service';
import { SyncStatusComponent } from './shared/sync-status.component';

@Component({ selector: 'app-sync-status', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class SyncStatusStubComponent {}

describe('AppComponent navigation', () => {
  let fixture: ComponentFixture<AppComponent>;
  const mieSegnalazioni = signal<unknown[]>([]);
  const modificaConsentita = signal(false);
  const inAttesa = signal<number | null>(null);

  const crea = () => {
    fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  /** Opens the topbar "⋮" menu and returns its entries (the popup lives in <body>). */
  const apriMenu = async () => {
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('.menu-azioni button')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    return Array.from(document.body.querySelectorAll<HTMLElement>('.p-menu li[role="menuitem"], .p-menu .p-menu-item'));
  };

  beforeEach(() => {
    mieSegnalazioni.set([]);
    modificaConsentita.set(false);
    inAttesa.set(null);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        MessageService,
        ConfirmationService,
        { provide: ThemeService, useValue: { tema: signal('light'), imposta: () => undefined } },
        { provide: AuthService, useValue: { autenticato: signal(false), email: signal(null), logout: () => undefined } },
        { provide: AggiornamentoAppService, useValue: { disponibile: signal(false), aggiorna: () => undefined } },
        { provide: EventiStore, useValue: { mieSegnalazioni, online: signal(false), ultimaSincronizzazione: signal(null), sincronizza: () => Promise.resolve(true) } },
        { provide: PermessiService, useValue: { modificaConsentita } },
        { provide: RevisioneService, useValue: { inAttesa, azzera: () => undefined, aggiornaConteggio: () => Promise.resolve() } },
      ],
    });
    TestBed.overrideComponent(AppComponent, { remove: { imports: [SyncStatusComponent] }, add: { imports: [SyncStatusStubComponent] } });
  });

  afterEach(() => {
    document.body.querySelectorAll('.p-menu').forEach((m) => m.remove());
  });

  const vociMobile = (el: HTMLElement) =>
    Array.from(el.querySelectorAll<HTMLAnchorElement>('nav.nav-mobile a')).map((a) => ({
      testo: a.querySelector('span')?.textContent?.trim(),
      href: a.getAttribute('href'),
      aria: a.getAttribute('aria-label'),
      evidenziata: a.classList.contains('nav-mobile-plus'),
    }));

  describe('mobile bottom bar', () => {
    it('shows Home, Eventi, Segnala, Agenda and Info, in this order', () => {
      const el = crea();

      expect(vociMobile(el).map((v) => v.testo)).toEqual(['Home', 'Eventi', 'Segnala', 'Agenda', 'Info']);
      expect(vociMobile(el).map((v) => v.href)).toEqual(['/', '/eventi', '/eventi/nuovo', '/agenda', '/informazioni']);
    });

    it('highlights only "Segnala" and gives "Info" its full accessible name', () => {
      const voci = vociMobile(crea());

      expect(voci.filter((v) => v.evidenziata).map((v) => v.testo)).toEqual(['Segnala']);
      expect(voci.find((v) => v.testo === 'Info')?.aria).toBe('Informazioni');
      expect(voci.filter((v) => v.testo !== 'Info').every((v) => v.aria === null)).toBe(true);
    });

    it('keeps the same five entries when the user has own reports and can moderate', () => {
      mieSegnalazioni.set([{ id: 'a' }]);
      modificaConsentita.set(true);

      expect(vociMobile(crea()).map((v) => v.testo)).toEqual(['Home', 'Eventi', 'Segnala', 'Agenda', 'Info']);
    });
  });

  describe('desktop top navigation', () => {
    const vociDesktop = (el: HTMLElement) => Array.from(el.querySelectorAll('nav.nav-desktop a')).map((a) => a.textContent?.trim());

    it('is unchanged for an anonymous user', () => {
      expect(vociDesktop(crea())).toEqual(['Home', 'Eventi', 'Agenda']);
    });

    it('adds only "Le mie" when the device has an own report, never "Gestione"', () => {
      mieSegnalazioni.set([{ id: 'a' }]);
      modificaConsentita.set(true);
      inAttesa.set(3);

      expect(vociDesktop(crea())).toEqual(['Home', 'Eventi', 'Agenda', 'Le mie']);
    });

    it('does not add "Gestione" for a moderator without own reports', () => {
      modificaConsentita.set(true);
      inAttesa.set(3);

      expect(vociDesktop(crea())).toEqual(['Home', 'Eventi', 'Agenda']);
    });
  });

  describe('top menu', () => {
    const etichette = (voci: HTMLElement[]) => voci.map((v) => v.textContent?.trim());

    it('has Accedi and Informazioni only for an anonymous user', async () => {
      crea();

      expect(etichette(await apriMenu())).toEqual(['Accedi', 'Informazioni']);
    });

    it('adds "Le mie" (mobile-only) and "Gestione", before Informazioni', async () => {
      mieSegnalazioni.set([{ id: 'a' }]);
      modificaConsentita.set(true);
      crea();

      const voci = await apriMenu();

      expect(etichette(voci)).toEqual(['Accedi', 'Le mie', 'Gestione', 'Informazioni']);
      expect(voci.filter((v) => v.classList.contains('solo-mobile')).map((v) => v.textContent?.trim())).toEqual(['Le mie']);
    });
  });
});
