import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from './config.service';

/** Utente come lo restituisce `GET api/admin/utenti`. */
export interface UtenteAdmin {
  id: string;
  email: string;
  ruoli: string[];
}

/** `password` vuota in modifica = non cambiarla; `ruoli` sostituisce l'insieme dei ruoli dell'utente. */
export interface DatiUtente {
  email: string;
  password: string;
  ruoli: string[];
}

/** Client degli endpoint di amministrazione (`api/admin/*`, solo Admin). I ruoli esistenti sono fissi e si possono solo assegnare. */
@Injectable({ providedIn: 'root' })
export class AdminUtentiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  private url(percorso: string): string {
    return `${this.config.apiBaseUrl()}/api/admin/${percorso}`;
  }

  ruoli(): Promise<string[]> {
    return firstValueFrom(this.http.get<string[]>(this.url('ruoli')));
  }

  utenti(): Promise<UtenteAdmin[]> {
    return firstValueFrom(this.http.get<UtenteAdmin[]>(this.url('utenti')));
  }

  crea(dati: DatiUtente): Promise<UtenteAdmin> {
    return firstValueFrom(this.http.post<UtenteAdmin>(this.url('utenti'), dati));
  }

  modifica(id: string, dati: DatiUtente): Promise<UtenteAdmin> {
    return firstValueFrom(this.http.put<UtenteAdmin>(this.url(`utenti/${encodeURIComponent(id)}`), dati));
  }

  elimina(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(this.url(`utenti/${encodeURIComponent(id)}`)));
  }
}

/** Messaggio leggibile da una risposta di errore dell'API (ProblemDetails o ValidationProblem). */
export function messaggioErroreApi(err: unknown, predefinito: string): string {
  if (!(err instanceof HttpErrorResponse)) return predefinito;
  if (err.status === 0) return 'Server non raggiungibile.';
  if (err.status === 401 || err.status === 403) return 'Non hai i permessi per questa operazione: accedi di nuovo come Admin.';
  const corpo = err.error as { title?: string; errors?: Record<string, string[]> } | null;
  const dettagli = corpo?.errors ? Object.values(corpo.errors).flat() : [];
  if (dettagli.length > 0) return dettagli.join(' ');
  return corpo?.title ?? predefinito;
}
