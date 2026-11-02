# PLAN — Propagazione del `traceId` con l'header `X-Trace-Id`

## Obiettivo
Rendere vera la riga «Logging» di `CLAUDE.md` («`traceId` propagato con header `X-Trace-Id`»), come chiedono `core.md` §5 e `frontend.md` §2: il frontend invia un identificativo di correlazione a ogni richiesta verso l'API, il backend lo ritrova nei log, nelle risposte di errore e nell'header di risposta, e il frontend lo mostra all'utente negli errori 500 così può comunicarlo.

## Assunzioni
- Decisione dell'utente: pianificarlo (non toglierlo dal `CLAUDE.md`).
- Senza OpenTelemetry (non adottato) l'header è `X-Trace-Id` con un UUID, come scritto in `frontend.md` §2.
- Nessun dato personale nell'identificativo.
- Il valore in arrivo è non fidato (header esterno, `security.md`): si accetta solo un UUID ben formato, altrimenti il backend ne genera uno nuovo (mai concatenato nei log, solo come parametro del template strutturato).
- `AddProblemDetails()` oggi aggiunge già un `traceId` dei `ProblemDetails` basato su `Activity`/`TraceIdentifier`: va allineato al valore dell'header, senza duplicarlo.
- Conviene coordinarlo con il piano di `IExceptionHandler` (da scrivere, vedi `PUNTI-APERTI.md`), che deve restituire lo stesso `traceId` e non esporre dettagli interni.

## Passi
- [ ] 1. **Backend, middleware:** legge `X-Trace-Id` (solo UUID valido, altrimenti ne genera uno), lo imposta come identificativo della richiesta, lo apre come scope di log (`TraceId`) e lo scrive nell'header di risposta; i `ProblemDetails` riportano lo stesso `traceId`. File: nuovo metodo di estensione in `Extensions/`, registrato in `Program.cs` subito dopo `UseForwardedHeaders`; commenti XML in inglese.
- [ ] 2. **CORS:** consentire l'header di richiesta `X-Trace-Id` ed esporre `X-Trace-Id` nella risposta, nella policy esistente (`ServiceCollectionExtensions.cs`), senza aprire altro.
- [ ] 3. **Frontend, interceptor:** `HttpInterceptorFn` che aggiunge `X-Trace-Id` (UUID) alle sole richieste verso `apiBaseUrl` (mai verso URL di terzi), registrato in `provideHttpClient(withInterceptors([...]))` accanto a `auth.interceptor.ts`.
- [ ] 4. **Frontend, errori 500:** mostrare il `traceId` copiabile nel messaggio d'errore generico. Da decidere quale messaggio esiste oggi (le regole prevedono un toast tradotto con `traceId`; il progetto non ha libreria di traduzione, i testi stanno nei template).
- [ ] 5. **Test:** integration test (UUID valido propagato nell'header di risposta e nei `ProblemDetails`; valore ostile con a capo, troppo lungo o non UUID sostituito; richiesta senza header riceve un `traceId` nuovo; preflight CORS) e unit test dell'interceptor (header solo verso l'API, mai verso altri host; `HttpTestingController`).
- [ ] 6. **Documentazione:** `README.md`, `CLAUDE.md` (riga «Logging» confermata e dettagliata), `CHANGELOG.md`. Security review (`/security-review`): tocca input esterno (header) e log.

## File coinvolti
`Program.cs`, nuovo file in `Extensions/`, `Extensions/ServiceCollectionExtensions.cs` (CORS), `src/SagreEventi.Web/src/app/core/` (nuovo interceptor e spec, `app.config.ts`), componente o servizio che mostra gli errori 500, `tests/SagreEventi.Web.Server.Tests/`, `README.md`, `CLAUDE.md`, `CHANGELOG.md`.

## Test previsti
Unit (interceptor) e integration (middleware, CORS, input ostili), come sopra.

## Decisioni aperte
- Passo 4: dove e come mostrare il `traceId` all'utente (oggi non è chiaro quale messaggio d'errore 500 esista nell'interfaccia).
- Ordine e coordinamento con il piano di `IExceptionHandler` e con la migrazione a `OperationResults`, che toccano gli stessi file.
