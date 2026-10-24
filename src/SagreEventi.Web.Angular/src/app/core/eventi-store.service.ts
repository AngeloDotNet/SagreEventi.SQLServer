import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { EventiApiService } from './eventi-api.service';
import { confrontaPerInizio, nuovoId, parseUtc, toApiPayload } from './evento-utils';
import { PermessiService } from './permessi.service';
import { EsitoModerazione, Evento, EventoDraft, EventoLocale, StoreSnapshot } from './models';

const STORAGE_KEY = 'sagreeventi.store.v1';
/** Cursore della prima sincronizzazione. */
const SINCE_INIZIALE = '2020-01-01T00:00:00';
/** Allineato a `Eventi:MaxPerRichiesta` del server (appsettings.json). */
const MAX_EVENTI_PER_RICHIESTA = 20;
/** Allineato al limite di `GET api/Eventi/GetStati` del server. */
const MAX_ID_STATI = 50;

/**
 * Store offline-first: gli eventi vivono in localStorage e si sincronizzano con il server
 * con il protocollo push dei modificati, poi pull da `since`.
 */
@Injectable({ providedIn: 'root' })
export class EventiStore {
  private readonly api = inject(EventiApiService);
  private readonly permessi = inject(PermessiService);

  private readonly tutti = signal<EventoLocale[]>([]);
  private readonly cursore = signal<string | null>(null);

  readonly ultimaSincronizzazione = signal<string | null>(null);
  readonly sincronizzando = signal(false);
  readonly erroreSync = signal<string | null>(null);
  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);

  /** Eventi pubblici: esclude i conclusi e quelli non approvati (in attesa o rifiutati). Ordinati per data di inizio. */
  readonly eventi = computed(() => this.tutti().filter((e) => !e.eventoConcluso && eApprovato(e)).sort(confrontaPerInizio));
  /** Segnalazioni di questo dispositivo non ancora pubbliche. Un rifiuto non è comunicato: per chi segnala restano "in attesa". */
  readonly mieSegnalazioni = computed(() =>
    this.tutti().filter((e) => e.mio && !e.eventoConcluso && !eApprovato(e)).sort(confrontaPerInizio),
  );
  readonly daInviare = computed(() => this.tutti().filter((e) => e.dirty).length);
  readonly citta = computed(() =>
    [...new Set(this.eventi().map((e) => e.cittaEvento.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it')),
  );

  constructor() {
    this.carica();

    effect(() => {
      const snapshot: StoreSnapshot = {
        version: 1,
        eventi: this.tutti(),
        cursore: this.cursore(),
        ultimaSincronizzazione: this.ultimaSincronizzazione(),
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        // storage pieno o non disponibile: l'app continua a funzionare in memoria.
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.online.set(true);
        void this.sincronizza();
      });
      window.addEventListener('offline', () => this.online.set(false));
    }
  }

  trova(id: string): EventoLocale | undefined {
    return this.tutti().find((e) => e.id === id && !e.eventoConcluso);
  }

  crea(draft: EventoDraft): EventoLocale {
    const evento: EventoLocale = {
      ...draft,
      id: nuovoId(),
      eventoConcluso: false,
      dataOraUltimaModifica: new Date().toISOString(),
      dirty: true,
      mio: true,
      // Chi può modificare pubblica subito, gli altri passano dalla revisione (lo decide il server: qui è solo l'anteprima)
      stato: this.permessi.puoModificare() ? 'Approvato' : 'InAttesa',
    };
    this.tutti.update((list) => [...list, evento]);
    return evento;
  }

  aggiorna(id: string, draft: EventoDraft): void {
    if (!this.permessi.puoModificare()) return;
    this.tutti.update((list) =>
      list.map((e) => (e.id === id ? { ...e, ...draft, dataOraUltimaModifica: new Date().toISOString(), dirty: true, protetta: true } : e)),
    );
  }

  async sincronizza(): Promise<boolean> {
    if (this.sincronizzando()) return false;
    this.sincronizzando.set(true);
    this.erroreSync.set(null);

    try {
      // 1. Push: invia gli eventi modificati in locale.
      // Senza il ruolo le modifiche protette restano in attesa: il server le ignorerebbe e andrebbero perse.
      const puoModificare = this.permessi.puoModificare();
      const daInviare = this.tutti().filter((e) => e.dirty && (!e.protetta || puoModificare));
      if (daInviare.length > 0) {
        // Il server accetta al massimo MAX_EVENTI_PER_RICHIESTA eventi per chiamata
        for (let i = 0; i < daInviare.length; i += MAX_EVENTI_PER_RICHIESTA) {
          await firstValueFrom(this.api.updateEventi(daInviare.slice(i, i + MAX_EVENTI_PER_RICHIESTA).map(toApiPayload)));
        }
        const inviati = new Map(daInviare.map((e) => [e.id, e.dataOraUltimaModifica]));
        this.tutti.update((list) =>
          list
            // Se l'utente ha modificato l'evento durante l'invio, il timestamp è cambiato e resta da inviare.
            .map((e) => (inviati.get(e.id) === e.dataOraUltimaModifica ? { ...e, dirty: false, protetta: false } : e))
            // Gli eventi conclusi e già inviati non servono più in locale.
            .filter((e) => !(e.eventoConcluso && !e.dirty)),
        );
      }

      // 2. Pull: scarica le modifiche del server successive al cursore.
      const remoti = await firstValueFrom(this.api.getEventi(this.cursore() ?? SINCE_INIZIALE));
      this.unisci(remoti ?? []);
      await this.aggiornaStati();
      this.ultimaSincronizzazione.set(new Date().toISOString());
      return true;
    } catch (err) {
      this.erroreSync.set(descriviErrore(err));
      return false;
    } finally {
      this.sincronizzando.set(false);
    }
  }

  /** Chiede al server l'esito delle mie segnalazioni non ancora approvate. Un errore qui non fa fallire la sincronizzazione. */
  private async aggiornaStati(): Promise<void> {
    const ids = this.tutti()
      .filter((e) => e.mio && !e.dirty && !eApprovato(e))
      .map((e) => e.id);
    if (ids.length === 0) return;

    try {
      const esiti = new Map<string, EsitoModerazione>();
      for (let i = 0; i < ids.length; i += MAX_ID_STATI) {
        for (const s of await firstValueFrom(this.api.getStati(ids.slice(i, i + MAX_ID_STATI)))) esiti.set(s.id, s);
      }
      this.tutti.update((list) =>
        list.map((e) => {
          const s = esiti.get(e.id);
          return s && e.mio ? { ...e, stato: s.stato } : e;
        }),
      );
    } catch {
      // Gli esiti si riprovano alla prossima sincronizzazione.
    }
  }

  private unisci(remoti: Evento[]): void {
    if (remoti.length === 0) return;

    const locali = new Map(this.tutti().map((e) => [e.id, e]));
    let cursore = this.cursore();

    for (const r of remoti) {
      const l = locali.get(r.id);
      if (r.eventoConcluso) {
        locali.delete(r.id);
      } else if (!l || !l.dirty || parseUtc(r.dataOraUltimaModifica) >= parseUtc(l.dataOraUltimaModifica)) {
        locali.set(r.id, { ...normalizza(r), mio: l?.mio });
      }
      if (!cursore || parseUtc(r.dataOraUltimaModifica) > parseUtc(cursore)) {
        cursore = r.dataOraUltimaModifica;
      }
    }

    this.tutti.set([...locali.values()]);
    this.cursore.set(cursore);
  }

  private carica(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const snap = JSON.parse(raw) as Partial<StoreSnapshot>;
      if (Array.isArray(snap.eventi)) this.tutti.set(snap.eventi.filter((e) => !!e && typeof e.id === 'string'));
      if (typeof snap.cursore === 'string') this.cursore.set(snap.cursore);
      if (typeof snap.ultimaSincronizzazione === 'string') this.ultimaSincronizzazione.set(snap.ultimaSincronizzazione);
    } catch {
      // dati locali corrotti: si riparte da zero e si risincronizza.
    }
  }
}

function normalizza(r: Evento): EventoLocale {
  return {
    id: r.id,
    nomeEvento: r.nomeEvento ?? '',
    cittaEvento: r.cittaEvento ?? '',
    dataInizioEvento: r.dataInizioEvento,
    dataFineEvento: r.dataFineEvento,
    descrizioneEvento: r.descrizioneEvento ?? '',
    eventoConcluso: !!r.eventoConcluso,
    dataOraUltimaModifica: r.dataOraUltimaModifica,
    stato: r.stato,
    dirty: false,
  };
}

/** Un evento senza stato arriva da versioni precedenti all'introduzione della moderazione ed è considerato pubblico. */
function eApprovato(e: EventoLocale): boolean {
  return !e.stato || e.stato === 'Approvato';
}

function descriviErrore(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Il server non risponde. Controlla la connessione e l\'indirizzo dell\'API.';
    return `Il server ha risposto con errore ${err.status}.`;
  }
  return 'Sincronizzazione non riuscita.';
}
