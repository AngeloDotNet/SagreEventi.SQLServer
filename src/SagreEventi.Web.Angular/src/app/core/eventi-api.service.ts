import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';
import { Evento } from './models';

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

  /** PUT api/Eventi/UpdateEventi → inserisce i nuovi eventi e aggiorna quelli più recenti sul server. */
  updateEventi(eventi: Evento[]): Observable<string> {
    return this.http.put(this.url('UpdateEventi'), eventi, { responseType: 'text' });
  }
}
