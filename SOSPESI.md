# Attività sospese

Piani `PLAN-migrazione-backend.md` (step 0-9) e `PLAN-moderazione-eventi.md` (M1-M6) completati nel codice. Restano solo verifiche e azioni manuali. Aggiornato il 2026-10-25.

## Da provare a mano

- [ ] **Docker (step 8):** i file sono scritti ma le immagini non sono mai state costruite né provate (Docker non è installato sulla macchina di sviluppo). Eseguire la checklist in [TEST-MANUALI.md](TEST-MANUALI.md).
- [ ] **Browser:** giro end-to-end non ancora provato: segnalazione anonima → «Le mie» → approvazione/rifiuto in `/gestione/revisione` → ritiro di un evento approvato.
- [ ] **Browser:** menu «Gestione» (schede Revisione e Utenti), scheda «Conclusi» visibile solo all'Admin (riavviare prima l'API), gestione utenti in `/gestione/utenti`.
- [ ] **SQL Server reale:** la scadenza automatica (`ExecuteUpdateAsync` in `ConcludiScadutiAsync`) e le migrazioni sono provate solo su SQLite nei test.

## Azioni di configurazione e dati

- [ ] Dopo l'aggiornamento di un database esistente tutti gli eventi sono `InAttesa`: accedere come Admin/Editor e approvarli da `/gestione/revisione` (fino a 100 per volta).
- [ ] `dotnet ef database update --project src/SagreEventi.Web.Server` (oppure lasciare `Database:MigraAllAvvio`, che le applica all'avvio).
- [ ] `Identity:Admin`, `Identity:Editor` e `Cors:Origins` in `appsettings.local.json` (git-ignored); cambiare le password di esempio di `appsettings.json` prima di ogni deploy.
- [ ] In sviluppo con `ng serve` e proxy, `apiBaseUrl` vuoto in `public/config.json`.
- [ ] Facoltativo: aggiungere `Eventi:ScadenzaIntervalloMinuti` ad `appsettings.json` (vale il default di 60 minuti).

## Limiti noti (scelte volute)

- Gli access token già emessi restano validi fino a scadenza (1 ora) dopo un cambio ruolo o una cancellazione utente; i refresh token no.
- Una segnalazione rifiutata resta «in attesa» sul dispositivo di chi l'ha fatta (nessuna comunicazione del rifiuto).
- Il limite del corpo di 5 MB (Kestrel) non è coperto dai test automatici; da verificare con la prova `413` di `TEST-MANUALI.md`.
- Il contatore di Revisione non si aggiorna in tempo reale.
