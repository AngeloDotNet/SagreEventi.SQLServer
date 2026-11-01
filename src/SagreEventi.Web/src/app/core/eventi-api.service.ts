import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AltchaChallenge } from './altcha-solver';
import { ConfigService } from './config.service';
import { EsitoModerazione, Evento } from './models';

/** Client dei due endpoint esposti da `EventiController` (route `api/Eventi/{action}`). */
@Injectable({ providedIn: 'root' })
export class EventiApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  private url(action: string): string {
    return `${this.config.apiBaseUrl()}/api/Eventi/${action}`;
  }

  /** GET api/Eventi/GetEventi?since=... → eventi modificati dopo `since`. */
  getEventi(since: string): Observable<Evento[]> {
    return this.http.get<Evento[]>(this.url('GetEventi'), { params: { since } });
  }

  /** GET api/Eventi/GetStati?ids=... → esito della moderazione degli eventi segnalati (anonimo, max 50 id). */
  getStati(ids: string[]): Observable<EsitoModerazione[]> {
    return this.http.get<EsitoModerazione[]>(this.url('GetStati'), { params: { ids } });
  }

  /** GET api/Eventi/GetChallenge → challenge anti-bot (proof of work) firmata dal server. */
  getChallenge(): Observable<AltchaChallenge> {
    return this.http.get<AltchaChallenge>(this.url('GetChallenge'));
  }

  /** PUT api/Eventi/UpdateEventi → inserisce i nuovi eventi e aggiorna quelli più recenti sul server. `altcha` è la prova anti-bot (header `X-Altcha`). */
  updateEventi(eventi: Evento[], altcha?: string): Observable<string> {
    const headers = altcha ? { 'X-Altcha': altcha } : undefined;
    return this.http.put(this.url('UpdateEventi'), eventi, { responseType: 'text', headers });
  }
}
