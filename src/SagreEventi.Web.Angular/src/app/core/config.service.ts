import { Injectable, computed, signal } from '@angular/core';

export interface AppConfig {
  /** URL base dell'API (es. `https://api.example.com`). Vuoto = stessa origine, utile con il proxy di sviluppo. */
  apiBaseUrl: string;
}

/** Legge `config.json` all'avvio, così l'URL dell'API si cambia senza ricompilare. */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly config = signal<AppConfig>({ apiBaseUrl: 'https://localhost:5001' });
  readonly apiBaseUrl = computed(() => this.config().apiBaseUrl.replace(/\/+$/, ''));

  async load(): Promise<void> {
    try {
      const res = await fetch('config.json', { cache: 'no-store' });
      if (!res.ok) return;
      const json = (await res.json()) as Partial<AppConfig>;
      if (typeof json.apiBaseUrl === 'string') {
        this.config.set({ apiBaseUrl: json.apiBaseUrl });
      }
    } catch {
      // config.json assente o non valido: si usa la configurazione di default.
    }
  }
}
