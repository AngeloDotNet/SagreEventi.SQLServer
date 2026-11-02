# PLAN — Fail-safe a 6 ore, throttle 1 minuto, timeout della factory (FusionCache)

Stato: da eseguire in un secondo momento (non urgente). Definito il 2026-11-01.

## Obiettivo
Rendere la lettura pubblica degli eventi (`EfCoreEventiService.GetEventiAsync`) resistente a un database lento o irraggiungibile durante una sagra: servire il dato vecchio invece di far attendere o fallire l'utente.

## Valori proposti
| Parametro | Oggi | Proposto |
|---|---|---|
| `Duration` | 5 min | 5 min (invariato) |
| `FailSafeMaxDuration` | 5 min (uguale a `Duration`: il fail-safe oggi non protegge) | 6 ore |
| `FailSafeThrottleDuration` | 5 min | 1 min |
| `FactorySoftTimeout` | assente | 1,5 s |
| `FactoryHardTimeout` | assente | 8 s |
| `JitterMaxDuration` | 30 s | 30 s (invariato) |

Il timeout morbido vale solo se esiste già un dato vecchio da servire; con cache vuota (primo avvio, riavvio) vale solo il timeout rigido.

## Assunzioni
- Cache solo L1, nessun L2/Redis (scelta del `CLAUDE.md`, riga «Cache»).
- La modifica è una configurazione avanzata di una cache già approvata: richiede il via esplicito dell'utente e l'aggiornamento della riga «Cache» del `CLAUDE.md`.
- Invalidazione per tag `eventi` invariata (conclusione, scrittura, revisione).

## Problemi emersi dall'analisi del codice (da risolvere nel piano)
1. **`DbContext` scoped usato dalla factory.** Con il timeout morbido la query continua in background anche dopo la fine della richiesta. Oggi la factory usa il `dbContext` della richiesta (`EfCoreEventiService.cs:35`) e il token della richiesta (`cancellationToken`, ignorando quello della factory `_`): a richiesta conclusa il contesto è già eliminato e il token annullato, quindi l'aggiornamento in background fallirebbe e la cache non si rinfrescherebbe. Serve che la factory crei il proprio contesto e usi il token fornito da FusionCache. **Deciso il 2026-11-01: `IDbContextFactory<AppDbContext>`** (non `IServiceScopeFactory`), da registrare nella DI accanto al `DbContext` attuale.
2. **Memoria con fail-safe a 6 ore.** La chiave dipende da `since`, scelto dal client e arrotondato al minuto (`EfCoreEventiService.cs:31`): con il fail-safe ogni chiave resta in memoria fino a 6 ore invece di 5 minuti, quindi un client può far crescere la cache. **Deciso il 2026-11-01: limitare `since`** (non un limite di dimensione della cache). Attenzione: la prima sincronizzazione del client invia `since` vuoto (`DateTime.MinValue`, `EventiEndpoints.cs:52`) per scaricare tutto, quindi non si riporta `since` a una finestra di giorni (si perderebbero eventi vecchi ancora in programma). Implementazione: un `since` più vecchio della soglia diventa `DateTime.MinValue` (download completo, superset che il client unisce); un `since` nel futuro diventa "adesso" (`TimeProvider`). **Soglia deciso il 2026-11-01: 30 giorni.**

## Passi
- [ ] 1. Decisioni aperte: ~~scelta tra `IDbContextFactory` e `IServiceScopeFactory` (problema 1)~~ deciso: `IDbContextFactory`; ~~soglia per `since`~~ deciso: limitare `since`, soglia 30 giorni; ~~branch~~ deciso il 2026-11-01: branch dedicato da `develop`, nome proposto `feature/cache-failsafe` (da riconfermare prima di crearlo, a lavoro avviato); ~~conferma finale dei valori~~ confermati dall'utente il 2026-11-01 (6 ore, 1 min, 1,5 s, 8 s).
- [ ] 2. Verificare nella versione installata di FusionCache nome e semantica di `FactorySoftTimeout`, `FactoryHardTimeout` e `SetFailSafe`, e il comportamento di `RemoveByTag` con il fail-safe (le voci scadute restano utilizzabili come dato vecchio?).
- [ ] 3. Test prima del codice: factory lenta con dato vecchio presente (risponde subito con il dato vecchio, la cache si aggiorna dopo); factory che fallisce con dato vecchio (serve il vecchio, riprova dopo 1 minuto); cache vuota con factory lenta (errore controllato entro il timeout rigido); invalidazione per tag ancora efficace. Usare `TimeProvider` finto, nessuno sleep arbitrario.
- [ ] 4. Modificare `GetEventiAsync`: nuovi valori, factory con contesto proprio e token della factory; rimuovere il commento con la vecchia `SetFailSafe(30 min, 1 min)`.
- [ ] 5. Verificare come `IExceptionHandler` risponde al timeout rigido con cache vuota (atteso `ProblemDetails` con chiave di traduzione, non 500 con dettagli; valutare 503).
- [ ] 6. Build senza warning, test passati, `dotnet list package --vulnerable --include-transitive` pulito.
- [ ] 7. Aggiornare la riga «Cache» del `CLAUDE.md` (nuovi valori e data), `README.md`/`DEPLOY.md` se citano la cache, e `CHANGELOG.md`.

## File coinvolti
- `src/SagreEventi.Web.Server/Models/Services/Application/EfCoreEventiService.cs`
- `src/SagreEventi.Web.Server/Extensions/ServiceCollectionExtensions.cs` (registrazione della factory del contesto, se scelta)
- `src/SagreEventi.Web.Server/Extensions/ApplicationExtension.cs` e `Options/FusionCacheOptions.cs` (solo se i nuovi valori vanno anche nei default o nella configurazione)
- `tests/SagreEventi.Web.Server.Tests/` (nuovi test sulla cache)
- `CLAUDE.md`, `CHANGELOG.md`, eventualmente `README.md`/`DEPLOY.md`

## Test previsti
Unit/integration come al passo 3, più un test sull'handler di errore (passo 5). Test di sicurezza con input ostili sul parametro `since` (valori estremi, date molto vecchie o future) per verificare che il numero di chiavi resti limitato. Copertura ≥ 80% sul codice modificato.

## Note
- Con il database giù, un evento annullato o modificato resta visibile fino al ripristino (fino a 6 ore): limite accettato.
- Con più repliche la coerenza resta eventuale (L1 per processo), come già indicato nel `CLAUDE.md`.

Ogni step richiede il "vai" esplicito.
