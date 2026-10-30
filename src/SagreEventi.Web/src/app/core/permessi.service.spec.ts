import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { PermessiService, RUOLO_ADMIN, RUOLO_EDITOR, richiedeAdmin, richiedeModifica } from './permessi.service';

describe('permessi', () => {
  const ruoli = signal<string[]>([]);
  const autenticato = signal(false);

  beforeEach(() => {
    ruoli.set([]);
    autenticato.set(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { autenticato: computed(() => autenticato()), ruoli: computed(() => ruoli()) } },
      ],
    });
  });

  /** Signs in with the given roles (an empty list is a user without any role). */
  const accedi = (...r: string[]) => {
    autenticato.set(true);
    ruoli.set(r);
  };

  describe('PermessiService', () => {
    it('grants nothing to an anonymous user', () => {
      const permessi = TestBed.inject(PermessiService);

      expect(permessi.autenticato()).toBe(false);
      expect(permessi.eAdmin()).toBe(false);
      expect(permessi.modificaConsentita()).toBe(false);
      expect(permessi.puoModificare()).toBe(false);
    });

    it('grants everything to an Admin', () => {
      const permessi = TestBed.inject(PermessiService);
      accedi(RUOLO_ADMIN);

      expect(permessi.autenticato()).toBe(true);
      expect(permessi.eAdmin()).toBe(true);
      expect(permessi.puoModificare()).toBe(true);
    });

    it('lets an Editor edit but not administer', () => {
      const permessi = TestBed.inject(PermessiService);
      accedi(RUOLO_EDITOR);

      expect(permessi.eAdmin()).toBe(false);
      expect(permessi.puoModificare()).toBe(true);
    });

    it('grants nothing to a signed-in user without roles or with unknown roles', () => {
      const permessi = TestBed.inject(PermessiService);

      accedi();
      expect(permessi.puoModificare()).toBe(false);

      accedi('Guest', 'admin', 'EDITOR');
      expect(permessi.eAdmin()).toBe(false);
      expect(permessi.puoModificare()).toBe(false);
    });

    it('follows the session when roles change', () => {
      const permessi = TestBed.inject(PermessiService);
      accedi(RUOLO_EDITOR);
      expect(permessi.puoModificare()).toBe(true);

      accedi();
      expect(permessi.puoModificare()).toBe(false);
    });
  });

  describe('richiedeAdmin', () => {
    const esegui = () =>
      TestBed.runInInjectionContext(() =>
        richiedeAdmin({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      );

    it('lets an Admin through', () => {
      accedi(RUOLO_ADMIN);
      expect(esegui()).toBe(true);
    });

    it.each([
      ['anonymous', []],
      ['Editor', [RUOLO_EDITOR]],
    ])('redirects %s to the home page', (_nome, r) => {
      if (r.length > 0) accedi(...r);

      const esito = esegui();

      expect(esito).toBeInstanceOf(UrlTree);
      expect(String(esito)).toBe('/');
    });
  });

  describe('richiedeModifica', () => {
    const esegui = (id: string | null) =>
      TestBed.runInInjectionContext(() =>
        richiedeModifica({ paramMap: { get: () => id } } as unknown as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      );

    it.each([RUOLO_ADMIN, RUOLO_EDITOR])('lets %s through', (ruolo) => {
      accedi(ruolo);
      expect(esegui('abc')).toBe(true);
    });

    it('redirects to the event detail when the route has an id', () => {
      const esito = esegui('abc');

      expect(esito).toBeInstanceOf(UrlTree);
      expect(String(esito)).toBe('/eventi/abc');
    });

    it('redirects to the events list when the route has no id', () => {
      expect(String(esegui(null))).toBe('/eventi');
    });

    it('encodes a hostile id instead of building an arbitrary URL', () => {
      const esito = String(esegui('../admin?x=1#y'));

      expect(esito.startsWith('/eventi/')).toBe(true);
      expect(esito).not.toContain('?');
      expect(esito).not.toContain('#');
      expect(esito.split('/')).toHaveLength(3);
    });
  });
});
