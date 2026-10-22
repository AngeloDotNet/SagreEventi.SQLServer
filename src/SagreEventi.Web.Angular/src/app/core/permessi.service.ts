import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Cosa può fare l'utente corrente. Il backend non ha ancora registrazione e login,
 * quindi la modifica degli eventi esistenti è disabilitata per tutti.
 * Quando arriverà l'autenticazione, basterà impostare `autenticato` in base alla sessione.
 */
@Injectable({ providedIn: 'root' })
export class PermessiService {
  readonly autenticato = signal(false);

  puoModificare(): boolean {
    return this.autenticato();
  }
}

/** Blocca le rotte riservate agli utenti registrati, riportando al dettaglio dell'evento. */
export const richiedeModifica: CanActivateFn = (route) => {
  if (inject(PermessiService).puoModificare()) return true;
  const id = route.paramMap.get('id');
  return inject(Router).createUrlTree(id ? ['/eventi', id] : ['/eventi']);
};
