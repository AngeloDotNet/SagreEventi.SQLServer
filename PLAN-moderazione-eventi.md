# PLAN — Moderazione degli eventi segnalati

> **Stato: completato (M1–M6, 2026-10-23).** Resta da fare a mano: giro end-to-end nel browser e approvazione degli eventi esistenti da `/revisione`.

> Si procede **uno step alla volta, solo dopo il "vai" esplicito**; a build ok si registra in `CHANGES.md`; mai commit. Prerequisito: step 6-bis di `PLAN-migrazione-backend.md`.

## Context
Oggi un utente anonimo segnala un evento (insert anonimo in `PUT /api/Eventi/UpdateEventi`) e l'evento è subito visibile a tutti: spam e contenuti abusivi finiscono nella lista pubblica. Si vuole che l'evento resti **non visibile finché un utente Editor/Admin lo approva**.

## Decisioni già prese
- Stato `InAttesa` / `Approvato` / `Rifiutato`. Anonimo → `InAttesa`; Editor/Admin → direttamente `Approvato`.
- Chi ha segnalato continua a vedere il proprio evento sul dispositivo con etichetta "In attesa di approvazione"; gli altri no.
- I rifiutati si **conservano** (con motivo), non si cancellano.
- **Eventi già presenti nel DB: tutti `InAttesa`** (spariscono dal pubblico finché non rivisti → serve l'approvazione multipla, step M3/M5).
- **Si parte dopo lo step 6-bis** del piano di migrazione (il server imposta `DataOraUltimaModifica = UtcNow` a ogni scrittura: la moderazione ne dipende, perché approvare = nuovo timestamp = i client ricevono l'evento).

## Scelte di design (da rivedere in approvazione)
1. **`GetEventi` resta pubblico per tutti** (solo `Approvato`, più i "tombstone" sotto). I revisori NON ricevono gli eventi in attesa dal pull offline: usano endpoint dedicati online-only. Così cache FusionCache (`eventi_cache_key:{since}`) e cursore restano invariati, nessuna perdita di eventi per cursore già avanzato, nessun dato da ripulire al logout.
2. **Ritiro di un evento già approvato** = `Rifiutato` + `EventoConcluso = true`: riusa il meccanismo esistente con cui i client eliminano l'evento al pull (`unisci`, `eventi-store.service.ts:137`). Senza questo i client terrebbero in locale un evento non più pubblico.
3. **Esito per chi ha segnalato**: nuovo `GET /api/Eventi/GetStati?ids=...` anonimo (max 50 id, rate limit): restituisce `{id, stato, motivoRifiuto}`. Gli id sono generati dal client (`nuovoId()`, da verificare che siano UUID non indovinabili: l'endpoint espone lo stato di chi conosce l'id). Un approvato arriva comunque col normale pull.
4. Il server **non si fida mai** di stato/motivo inviati dal client (campi solo in uscita nel DTO). Contratto additivo: Blazor (finché esiste) non si rompe.
5. **Gestione utenti e ruoli: fuori da questo piano.** Resta riservata al solo `Admin` ed è prevista nello **step 7-bis** di `PLAN-migrazione-backend.md` (sezione "Amministrazione", policy `SoloAdmin`). La revisione degli eventi usa invece la policy `PuoModificare` (Admin ed Editor); nessuna regola diversa tra i due ruoli, anche il ritiro di un evento approvato è consentito a entrambi.
6. Fuori scopo: modifica del contenuto di un evento in attesa da parte del revisore (può solo approvare/rifiutare; la modifica resta il flusso esistente sugli approvati). Interazione con 7-ter: un evento `InAttesa` scaduto viene concluso come gli altri ed esce dalla coda di revisione.

## Step
**M1. Modello e migrazione** — `Models/Entities/Evento.cs`: `Stato` (enum `StatoModerazione`, default `InAttesa`), `MotivoRifiuto`, `RevisionatoDa` (email), `DataRevisione`. `EventoModel` (Shared): `Stato`, `MotivoRifiuto` solo output. `Mapping/EventoMappings.cs`: `ToDto` li proietta, `ApplyFrom`/`ToEntity` li ignorano. Migrazione `AddModerazione` con righe esistenti = `InAttesa` (verificare `has-pending-model-changes`). Test mapping.

**M2. Insert e lettura pubblica** — `EfCoreEventiService.UpdateEventiAsync`: nuovo evento `Approvato` se `consentiModifiche`, altrimenti `InAttesa`; stato mai preso dal payload; update di esistenti senza toccare lo stato. `GetEventiAsync`: filtra `Stato == Approvato` (tombstone ritirati già coperti da `EventoConcluso`). Test: anonimo insert → non compare nel GET; Editor insert → compare; payload con `stato=Approvato` da anonimo ignorato.

**M3. Endpoint di revisione** — `Endpoints/RevisioneEndpoints.cs`, gruppo `/api/Eventi/Revisione` con policy `PuoModificare`: `GET /DaRivedere?stato=InAttesa|Rifiutato` (ordinati, limite), `POST /Approva {ids[]}` e `POST /Rifiuta {ids[], motivo}` (max 100 id, validazione esplicita, `UtcNow`, `RevisionatoDa` da claim, invalida cache; rifiuto di un approvato = tombstone). Più `GET /api/Eventi/GetStati` anonimo + rate limiter (riusa `IdentityServices` rate limiting). Aggiornare OpenAPI. Test 401/403/200, approvazione multipla, ritiro con tombstone, GetStati.

**M4. Angular: store e segnalazione** — `core/models.ts` (`stato`, `motivoRifiuto`, `mio`), `eventi-store.service.ts`: `crea` marca `mio`; dopo push anonimo `stato='InAttesa'`; in `sincronizza` chiamare `GetStati` per i `mio` non approvati e aggiornare; `eventi()` pubblico solo `Approvato` (o legacy senza stato); nuovo computed `mieSegnalazioni`. UI: messaggio dopo l'invio ("sarà visibile dopo la revisione"), sezione "Le mie segnalazioni" con badge In attesa/Rifiutato (+ motivo) e rimozione locale. Aggiornare `evento-form.page.ts`/`home.page.ts`.

**M5. Angular: pagina di revisione** — rotta `/revisione` con guard `richiedeModifica` (`permessi.service.ts`), `RevisioneService` verso gli endpoint M3, tabella con selezione multipla, Approva / Rifiuta (dialog con motivo), tab In attesa / Rifiutati; voce di menu con contatore visibile solo a Admin/Editor (`app.ts`).

**M6. Chiusura** — verifica end-to-end, nota nel README sul flusso, `CHANGES.md`. Azione manuale dell'utente: dopo la migrazione approvare gli eventi esistenti da `/revisione` (selezione multipla).

## Verifica
- `dotnet build` 0 errori/0 avvisi e `dotnet test` (nuovi test per M1–M3); `ng build` e `tsc --noEmit`.
- A mano: anonimo segnala → vede "In attesa" sul proprio dispositivo, da un secondo browser l'evento non compare; login Editor → `/revisione` → Approva → compare al secondo browser dopo la sync; Rifiuta con motivo → il segnalante vede il motivo; ritiro di un approvato → sparisce dai client.
