import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from './config.service';

const STORAGE_KEY = 'sagreeventi.auth.v1';
/** Margine prima della scadenza entro cui il token viene rinnovato. */
const MARGINE_SCADENZA_MS = 30_000;

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  /** Durata del token in secondi. */
  expiresIn: number;
}

interface UtenteResponse {
  email: string;
  ruoli: string[];
}

interface Sessione {
  accessToken: string;
  refreshToken: string;
  /** Istante di scadenza dell'access token (ms da epoch). */
  scadenza: number;
  email: string;
  ruoli: string[];
}

/**
 * Login con i token bearer di ASP.NET Core Identity (`/api/auth`).
 * La sessione vive in `sessionStorage`: si perde chiudendo la scheda.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  private readonly sessione = signal<Sessione | null>(this.ripristina());
  private rinnovoInCorso: Promise<boolean> | null = null;

  readonly autenticato = computed(() => this.sessione() !== null);
  readonly email = computed(() => this.sessione()?.email ?? null);
  readonly ruoli = computed(() => this.sessione()?.ruoli ?? []);

  private url(percorso: string): string {
    return `${this.config.apiBaseUrl()}/api/auth/${percorso}`;
  }

  accessToken(): string | null {
    return this.sessione()?.accessToken ?? null;
  }

  /** Vero se l'access token è scaduto o sta per scadere. */
  inScadenza(): boolean {
    const s = this.sessione();
    return !!s && s.scadenza - MARGINE_SCADENZA_MS <= Date.now();
  }

  async login(email: string, password: string): Promise<void> {
    const token = await firstValueFrom(this.http.post<TokenResponse>(this.url('login'), { email, password }));
    const utente = await firstValueFrom(
      this.http.get<UtenteResponse>(this.url('me'), { headers: { Authorization: `Bearer ${token.accessToken}` } }),
    );
    this.imposta({
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      scadenza: Date.now() + token.expiresIn * 1000,
      email: utente.email,
      ruoli: utente.ruoli,
    });
  }

  logout(): void {
    this.imposta(null);
  }

  /** Rinnova il token con il refresh token; più chiamate concorrenti condividono lo stesso rinnovo. */
  rinnova(): Promise<boolean> {
    this.rinnovoInCorso ??= this.eseguiRinnovo().finally(() => (this.rinnovoInCorso = null));
    return this.rinnovoInCorso;
  }

  /** Riallinea i ruoli con quelli attuali sul server (es. dopo una modifica fatta da un amministratore). */
  async aggiornaUtente(): Promise<void> {
    const corrente = this.sessione();
    if (!corrente) return;
    try {
      const utente = await firstValueFrom(this.http.get<UtenteResponse>(this.url('me')));
      this.imposta({ ...corrente, ...this.sessione(), email: utente.email, ruoli: utente.ruoli });
    } catch {
      // Il rinnovo o il logout in caso di 401 li gestisce l'interceptor.
    }
  }

  private async eseguiRinnovo(): Promise<boolean> {
    const corrente = this.sessione();
    if (!corrente) return false;
    try {
      const token = await firstValueFrom(
        this.http.post<TokenResponse>(this.url('refresh'), { refreshToken: corrente.refreshToken }),
      );
      this.imposta({
        ...corrente,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        scadenza: Date.now() + token.expiresIn * 1000,
      });
      return true;
    } catch {
      this.logout();
      return false;
    }
  }

  private imposta(sessione: Sessione | null): void {
    this.sessione.set(sessione);
    try {
      if (sessione) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessione));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage non disponibile: la sessione resta solo in memoria.
    }
  }

  private ripristina(): Sessione | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as Partial<Sessione>;
      if (typeof s.accessToken === 'string' && typeof s.refreshToken === 'string' && typeof s.scadenza === 'number') {
        return { accessToken: s.accessToken, refreshToken: s.refreshToken, scadenza: s.scadenza, email: s.email ?? '', ruoli: s.ruoli ?? [] };
      }
    } catch {
      // sessione corrotta: si riparte da utente anonimo.
    }
    return null;
  }
}
