import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from './config.service';
import { EsitoRevisione, Evento } from './models';

export type StatoDaRivedere = 'InAttesa' | 'Rifiutato';

/**
 * Client degli endpoint di revisione (`api/Eventi/Revisione/*`, solo Admin ed Editor) e contatore delle segnalazioni in attesa.
 * Gli eventi da rivedere non passano dallo store offline: si leggono solo online, direttamente dal server.
 */
@Injectable({ providedIn: 'root' })
export class RevisioneService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  /** Segnalazioni in attesa, per il contatore nel menu (null finché non è stato letto). */
  readonly inAttesa = signal<number | null>(null);

  private url(action: string): string {
    return `${this.config.apiBaseUrl()}/api/Eventi/Revisione/${action}`;
  }

  async daRivedere(stato: StatoDaRivedere): Promise<Evento[]> {
    const eventi = await firstValueFrom(this.http.get<Evento[]>(this.url('DaRivedere'), { params: { stato } }));
    if (stato === 'InAttesa') this.inAttesa.set(eventi.length);
    return eventi;
  }

  /** Eventi conclusi (scaduti o ritirati) in ogni stato, in sola lettura: solo Admin (`403` per gli altri). */
  conclusi(): Promise<Evento[]> {
    return firstValueFrom(this.http.get<Evento[]>(this.url('Conclusi')));
  }

  /** Aggiorna solo il contatore; un errore (offline, sessione scaduta) lascia il valore com'è. */
  async aggiornaConteggio(): Promise<void> {
    try {
      await this.daRivedere('InAttesa');
    } catch {
      /* il contatore è solo un'indicazione */
    }
  }

  approva(ids: string[]): Promise<EsitoRevisione> {
    return firstValueFrom(this.http.post<EsitoRevisione>(this.url('Approva'), { ids }));
  }

  /** La nota è facoltativa (solo storico per lo staff): vuota non viene inviata. */
  rifiuta(ids: string[], motivo?: string): Promise<EsitoRevisione> {
    return firstValueFrom(this.http.post<EsitoRevisione>(this.url('Rifiuta'), { ids, motivo: motivo || null }));
  }

  azzera(): void {
    this.inAttesa.set(null);
  }
}
