# PLAN — Periodi dei temi stagionali configurabili da database

Creato il 2026-11-02. Stato: **bozza, nessun file di codice toccato**.

## Obiettivo
Oggi i periodi dei temi stagionali sono costanti in `theme.service.ts` (`STAGIONI`). Renderli configurabili da un admin,
con salvataggio su database, senza dover rilasciare una nuova versione per spostare una data.

## Decisioni prese (2026-11-02)
- Una riga per **periodo**: `pasqua`, `ferragosto`, `halloween`, `natale`. Il periodo `natale` vale **sia per `natale` sia per `natale-scuro`** (un solo periodo condiviso, deciso il 2026-11-02): nel form l'admin vede una sola voce «Natale». I temi stagionali restano cinque, i periodi configurabili sono quattro.
- **Pasqua = regola configurabile**: resta calcolata dall'algoritmo (`pasqua(anno)`); si configurano solo i giorni
  prima e dopo la domenica di Pasqua (oggi 7 prima, 1 dopo). La UI mostra un messaggio: le date esatte si ricalcolano
  da sole ogni anno, quindi non vanno aggiornate a mano.
- Gli altri temi: inizio e fine come giorno/mese (senza anno), con periodo a cavallo d'anno ammesso (Natale).
- **Valori iniziali (seed della migrazione, deciso il 2026-11-02):** Halloween **24–31 ottobre** (oggi è 15 ottobre – 2 novembre: dal 1° novembre non si vede più); Ferragosto 1–20 agosto, Natale 1 dicembre – 6 gennaio e Pasqua 7 giorni prima / 1 dopo restano come oggi. Tutti attivi. L'admin può cambiarli dalla scheda «Temi». I valori predefiniti del frontend (fallback se la lettura fallisce) si allineano a questi, e lo spec di `theme.service` si aggiorna di conseguenza.
- **Limiti della Pasqua (deciso il 2026-11-02):** giorni prima da 0 a 14, giorni dopo da 0 a 7; fuori da questi intervalli il server risponde 400 con `ProblemDetails` e il form segnala l'errore sul campo.
- **Durata massima (deciso il 2026-11-02):** un periodo con giorno e mese dura al massimo 60 giorni (a cavallo d'anno incluso); giorno e mese devono esistere (niente 31 aprile; il 29 febbraio non è ammesso come estremo, per evitare l'ambiguità negli anni non bisestili). Altrimenti 400 con `ProblemDetails`.
- Lettura pubblica e anonima (serve anche ai visitatori); scrittura solo `SoloAdmin`.
- Frontend: se la lettura fallisce si usano i valori predefiniti già nel codice (l'app resta usabile offline).

## Decisioni aperte (una alla volta)
1. [x] Dove sta la sezione (deciso il 2026-11-02): **nuova scheda «Temi» in «Gestione»**, accanto a Revisione e Utenti. Come «Utenti»: link visibile solo se `permessi.eAdmin()`, route figlia di `gestione` con `canActivate: [richiedeAdmin]` in `app.routes.ts`; l'Editor non la vede e il server rifiuta comunque la scrittura (`SoloAdmin`).
2. [x] Disattivazione (deciso il 2026-11-02): ogni periodo ha un interruttore **«Attivo»** (colonna `Attivo`, default `true`). Un periodo non attivo non rende disponibile il tema in nessuna data; il form lo mostra e lo salva senza toccare le date. Per Natale l'interruttore vale per entrambi i temi.
3. [x] Cache della lettura pubblica (approvata il 2026-11-02): FusionCache solo L1, come per gli eventi (`EfCoreEventiService`): durata 5 minuti esplicita, fail-safe come la configurazione approvata, invalidazione con tag dopo ogni scrittura. Da annotare nella riga «Cache» di `CLAUDE.md` quando si implementa.
4. [~] Branch di lavoro (`feature/periodi-temi` da `develop`): deciso il 2026-11-02 di **prima committare le modifiche in sospeso** (`piano-commit.md`) e solo dopo creare il branch, partendo da un `develop` aggiornato. Nessun passo del piano parte prima.

## Ordine rispetto agli altri lavori (deciso il 2026-11-02)
Dopo i commit in sospeso (fase 0) e **prima del GPS** (`PLAN-gps.md`). La migrazione `AddPosizioneEventi` del GPS è già nell'albero, non committata: all'avvio del GPS va rigenerata dopo la migrazione dei temi, insieme allo snapshot. Il passo 1 di questo piano non deve includerla.

## Passi (uno alla volta, ok esplicito prima di ciascuno)
- [ ] 1. Backend: entità `PeriodoTema`, configurazione EF, migrazione con i valori attuali come seed.
- [ ] 2. Backend: servizio + endpoint `GET /api/temi/periodi` (anonimo) e `PUT /api/temi/periodi` (`SoloAdmin`), validazione (giorno/mese reali, limiti dei giorni di Pasqua), errori come `ProblemDetails`.
- [ ] 3. Test backend: unit (validazione) e integration (401/403/200, input ostili, overposting, JSON malformato).
- [ ] 4. Frontend: client API a mano e `ThemeService` che legge i periodi, con fallback ai predefiniti; adattare `theme.service.spec.ts`.
- [ ] 5. Frontend: sezione per admin con form e messaggio sulla Pasqua; test del componente.
- [ ] 6. `README`/`docs/` (se serve) e `CHANGELOG.md`; build, test e lint verdi.

## File coinvolti (da verificare in esecuzione)
- Backend: `Models/Entities/PeriodoTema.cs`, `Data` (DbContext + configurazione), `Migrations/`, `Models/Services/Application/`, `Endpoints/`, `Extensions/ServiceCollectionExtensions.cs`, `Shared/Models`.
- Frontend: `core/theme.service.ts` (+ spec), nuovo servizio API, `features/gestione` o `features/amministrazione`, `app.routes.ts`.
- Test: `tests/SagreEventi.Web.Server.Tests`, spec Vitest.

## Note
- Migrazione EF: il deploy richiede backend e frontend insieme. `Database:MigraAllAvvio` la applica all'avvio.
- Testi in italiano nei template (nessuna libreria di traduzione, vedi CLAUDE.md).
- Security review (`/security-review`) prima della consegna: tocca autorizzazione e input.
