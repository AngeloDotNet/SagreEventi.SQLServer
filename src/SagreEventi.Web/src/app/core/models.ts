/** Contratto dell'API: corrisponde a SagreEventi.Shared.Models.EventoModel (JSON camelCase). */
export interface Evento {
  id: string;
  nomeEvento: string;
  cittaEvento: string;
  /** Solo data, formato `YYYY-MM-DDT00:00:00` (senza fuso orario). */
  dataInizioEvento: string;
  dataFineEvento: string;
  descrizioneEvento: string;
  eventoConcluso: boolean;
  /** Istante di ultima modifica, ISO 8601 in UTC. */
  dataOraUltimaModifica: string;
  /** Esito della moderazione, deciso dal server (assente nelle risposte di versioni precedenti). */
  stato?: StatoModerazione;
  /** Nota di rifiuto (solo storico): la restituiscono solo gli endpoint di revisione, mai quelli pubblici. */
  motivoRifiuto?: string | null;
}

/** Stato di moderazione di un evento segnalato (valori dell'enum `StatoModerazione` del server). */
export type StatoModerazione = 'InAttesa' | 'Approvato' | 'Rifiutato';

/** Risposta di `GET api/Eventi/GetStati`. Un rifiuto non viene comunicato: il server lo restituisce come `InAttesa`. */
export interface EsitoModerazione {
  id: string;
  stato: StatoModerazione;
}

/** Risposta di `POST api/Eventi/Revisione/Approva|Rifiuta`: quanti eventi sono davvero cambiati. */
export interface EsitoRevisione {
  modificati: number;
}

/** Evento nello store locale: `dirty` = modificato in locale e non ancora inviato al server. */
export interface EventoLocale extends Evento {
  dirty?: boolean;
  /** Modifica a un evento già esistente: il server la accetta solo da Admin o Editor, quindi non va inviata senza il ruolo. */
  protetta?: boolean;
  /** Segnalato da questo dispositivo: resta visibile all'autore finché non è approvato (un rifiuto non gli viene comunicato). */
  mio?: boolean;
}

/** Campi che l'utente compila nel form. */
export type EventoDraft = Pick<
  Evento,
  'nomeEvento' | 'cittaEvento' | 'dataInizioEvento' | 'dataFineEvento' | 'descrizioneEvento'
>;

export type StatoEvento = 'in-corso' | 'in-arrivo' | 'terminato';

export interface StoreSnapshot {
  version: 1;
  eventi: EventoLocale[];
  /** Cursore di sincronizzazione: valore grezzo di `dataOraUltimaModifica` più recente ricevuto dal server. */
  cursore: string | null;
  ultimaSincronizzazione: string | null;
}
