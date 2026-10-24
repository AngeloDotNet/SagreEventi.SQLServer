import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { ConfigService } from './config.service';

/**
 * Aggiunge il token Bearer alle richieste verso l'API (solo a quella configurata, mai a terzi).
 * Il token scaduto viene rinnovato prima dell'invio: un token scaduto verrebbe trattato come anonimo
 * dal server, che ignorerebbe in silenzio le modifiche agli eventi esistenti.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const config = inject(ConfigService);

  const diAutenticazione = /\/api\/auth\/(login|refresh)$/i.test(req.url);
  if (!req.url.startsWith(`${config.apiBaseUrl()}/`) || diAutenticazione || !auth.accessToken()) {
    return next(req);
  }

  const conToken = (r: HttpRequest<unknown>, n: HttpHandlerFn) => {
    // Dopo un rinnovo fallito (logout) il token non c'è più: si invia anonimo, mai "Bearer null"
    const token = auth.accessToken();
    return n(r.headers.has('Authorization') || !token ? r : r.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  };

  const prima = auth.inScadenza() ? from(auth.rinnova()) : null;
  const invia = () =>
    conToken(req, next).pipe(
      catchError((err: unknown) => {
        // 401 con token apparentemente valido (revocato o orologi sfasati): un solo tentativo di rinnovo.
        if (err instanceof HttpErrorResponse && err.status === 401 && auth.autenticato()) {
          return from(auth.rinnova()).pipe(
            switchMap((ok) => (ok ? conToken(req.clone({ headers: req.headers.delete('Authorization') }), next) : throwError(() => err))),
          );
        }
        return throwError(() => err);
      }),
    );

  return prima ? prima.pipe(switchMap(invia)) : invia();
};
