import { Injectable, computed, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Ruoli definiti dal backend (`Ruoli` in SagreEventi.Web.Server). */
export const RUOLO_ADMIN = 'Admin';
export const RUOLO_EDITOR = 'Editor';

/**
 * Cosa può fare l'utente corrente, derivato dalla sessione e dai ruoli.
 * Modificare un evento esistente richiede il ruolo Admin o Editor. La conclusione non è una scelta degli utenti: la decide il server.
 */
@Injectable({ providedIn: 'root' })
export class PermessiService {
  private readonly auth = inject(AuthService);

  readonly autenticato = this.auth.autenticato;
  readonly eAdmin = computed(() => this.auth.ruoli().includes(RUOLO_ADMIN));
  readonly modificaConsentita = computed(() => this.eAdmin() || this.auth.ruoli().includes(RUOLO_EDITOR));

  puoModificare(): boolean {
    return this.modificaConsentita();
  }
}

/** Blocca le rotte riservate agli Admin, riportando alla home. */
export const richiedeAdmin: CanActivateFn = () =>
  inject(PermessiService).eAdmin() ? true : inject(Router).createUrlTree(['/']);

/** Blocca le rotte riservate a chi può modificare, riportando al dettaglio dell'evento. */
export const richiedeModifica: CanActivateFn = (route) => {
  if (inject(PermessiService).puoModificare()) return true;
  const id = route.paramMap.get('id');
  return inject(Router).createUrlTree(id ? ['/eventi', id] : ['/eventi']);
};
