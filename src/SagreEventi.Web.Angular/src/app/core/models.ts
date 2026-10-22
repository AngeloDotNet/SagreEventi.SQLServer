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
}

/** Evento nello store locale: `dirty` = modificato in locale e non ancora inviato al server. */
export interface EventoLocale extends Evento {
  dirty?: boolean;
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
