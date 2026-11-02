# PLAN — Piani ancora da scrivere e attività senza piano

Creato il 2026-11-01. È un **registro**, non un piano di lavoro: serve a non perdere i piani che non esistono ancora e le attività che non hanno ancora un `PLAN-*.md`. Nessun codice viene toccato da questo file. Quando di una voce si scrive il piano, la si spunta qui e si indica il file; quando l'attività è conclusa, la voce si toglie (la storia resta in `CHANGELOG.md`).

L'ordine di esecuzione proposto (fasi 0-6) è in `PUNTI-APERTI.md`, sezione «Ordine di esecuzione proposto». Come per ogni piano: un `PLAN-<nome>.md` per attività, una domanda alla volta all'utente, nessuna modifica senza il «vai».

## A. Piani da scrivere (già collocati nell'ordine di esecuzione)

- [ ] **A1. `IExceptionHandler` globale** — fase 4.2
  - Obiettivo: `IExceptionHandler` + `ProblemDetails` (RFC 9457) con `traceId`; oggi c'è solo `AddProblemDetails`.
  - Punti da coprire: nessuno stack trace né messaggio di eccezione fuori da Development (test dedicati); `OperationCanceledException` per annullamento della richiesta non è un errore applicativo (niente 500, niente log di errore); come risponde al timeout rigido della cache con cache vuota (`PLAN-failsafe-cache.md`, passo 5); conflitti di concorrenza e vincoli unique come 409 con chiave di traduzione (`backend.md` §4.1).
  - Coordinamento: `PLAN-trace-id.md` (viene dopo), migrazione a `OperationResults` (A2), `PLAN-allineamento-backend.md` (viene prima).

- [ ] **A2. Migrazione a `OperationResults` di Marco Minerva nel codice esistente** — fase 4.4
  - Oggi vale solo per il codice nuovo. Decisione del 2026-10-31: migrare l'esistente con piano dedicato, dopo i commit in sospeso e su un branch proprio.
  - Verificato il 2026-10-31: pacchetti `OperationResultTools` e `OperationResultTools.AspNetCore.Http` 1.0.39, MIT, `net10.0`, repository attivo. **Non verificati:** vulnerabilità note e deprecazione (da controllare al primo uso con `dotnet list package --vulnerable --include-transitive`).
  - Cosa cambia: i servizi restituiscono `Result`/`Result<T>` (oggi `int`, `bool`, modelli); gli endpoint usano `CreateResponse` al posto delle risposte di errore scritte a mano (circa 30 punti in 7 file: `AdminUtentiEndpoints`, `EventiEndpoints`, `RevisioneEndpoints`, `AltchaService`, ecc.); mapping personalizzato per 409, 412 e 422; errori sempre come `ProblemDetails` con chiavi di traduzione.
  - Coordinamento: dopo `PLAN-allineamento-backend.md`, insieme o dopo A1, per toccare gli stessi file una volta sola.

- [ ] **A3. Options come `record`** — fase 4.5
  - Oggi sono `sealed class` (scelta del 2026-10-31 per il binding); `backend.md` preferisce i `record`.
  - Attenzione: i test (es. `EmailOptionsTests`) modificano le proprietà dopo la creazione; con `init` vanno riscritti con `with { ... }`. Verificare il binding e `ValidateOnStart`.
  - Dopo `PLAN-allineamento-backend.md`.

- [ ] **A4. Colori del frontend con design token** — fase 5.3
  - Colori scritti a mano nei gradienti di `evento-utils.ts` e nell'SVG di `app.component.html` (le regole vogliono token).
  - Sostituire con variabili CSS o token PrimeNG e verificare a vista il tema chiaro, scuro e quelli stagionali. Piccolo; prima dei test di accessibilità (A5).

- [ ] **A5. Playwright e `@axe-core/playwright`** — fase 5.5
  - Test E2E dei flussi principali e accessibilità automatica con zero violazioni gravi (`core.md` §4), da estendere ai flussi della mappa e del GPS.
  - Da decidere nel piano: licenze (axe-core è MPL-2.0, ammesso come eccezione in `core.md` §3, da riverificare sul repository), download dei browser, backend di prova per i flussi con login, esecuzione in CI, istanza e modalità del database di test (si chiedono ogni volta, `frontend.md` §10).

## B. Attività senza piano

- [ ] **B1. Aggiornamento maggiore di Angular e PrimeNG** — fase 5.1
  - Angular 21.2.x → 22.2.x e PrimeNG 21.1.10 → 22.1.4, insieme a `@angular/cli`, `@angular/build`, `@angular/cdk`, `@primeuix/themes` e `primeicons`. Solo con `ng update`, mai a mano; branch dedicato; da proporre e chiedere conferma (`frontend.md` §2).
  - Risolverebbe anche le 16 vulnerabilità moderate in sviluppo (`minimatch` nella catena di `@angular/cli`, GHSA-g3hv-75wg-m249; 0 in produzione).
  - Da valutare nello stesso lavoro: Vitest 4 → 5, jsdom 27 → 30, TypeScript 5.9.3 → 7 (Angular fissa le versioni di TypeScript supportate).
  - Va fatto **prima** della verifica di fattibilità della CSP (`PLAN-security-headers.md`, passo 1): il modo in cui PrimeNG inietta gli stili può cambiare tra le versioni.

- [ ] **B2. Riformattazione generale con Prettier** — fase 5.2
  - Configurato (`.prettierrc.json`, script `format:check` e `format`) ma non imposto; il codice esistente non è formattato con Prettier (decisione del 2026-10-31).
  - Un commit dedicato, quando nessun altro branch frontend è aperto, dopo i commit in sospeso.

- [ ] **B3. Campanella delle notifiche** — fase 6 (idea dell'utente, 2026-10-31)
  - Icona nella barra, per tutti gli utenti, **sempre visibile** anche senza notifiche (con la dicitura «Nessuna notifica» o simile). Raccoglie ciò che richiede attenzione: aggiornamento della PWA (oggi icona dedicata), stato offline e errori di sincronizzazione (oggi `app-sync-status` e messaggi a comparsa) e, per admin ed editor, le segnalazioni da moderare (oggi «Gestione (N)» e il badge sul ⋮).
  - Da decidere nel piano: cosa è persistente e cosa temporaneo; se sostituisce l'icona di aggiornamento e il pulsante di sincronizzazione; il comportamento su mobile (la barra ha già sincronizza, tema e ⋮); cosa mostrare quando è vuota (idea: stato della connessione e ultima sincronizzazione). Nota: il numero delle segnalazioni scende solo quando si moderano, non esiste uno stato «letto».

- [ ] **B4. Ristrutturazione in Clean Architecture** — fase 6, opzionale
  - Quattro progetti (`Domain`, `Application`, `Infrastructure`, `Api`) con test di architettura obbligatori (`NetArchTest.Rules` MIT o `ArchUnitNET` Apache-2.0, licenza e compatibilità con .NET 10 da verificare). Oggi il backend è un solo progetto.
  - Da fare solo se la fase 4 mostra che serve; è il lavoro più costoso e tocca quasi tutto il backend.

- [ ] **B5. Passo 2 di `PLAN-xunit-v3`: progetto `IntegrationTests`** — dopo la fase 2.2
  - Nuovo progetto già su `xunit.v3`, con database SQL Server reale di prova con nome univoco creato e cancellato a ogni esecuzione (`backend.md` §4.5), test di sicurezza e di isolamento. Mai EF Core InMemory; SQLite solo se concordato.
  - **Da decidere prima:** quale istanza SQL Server di prova, con quali credenziali e come la raggiunge la CI; cosa del progetto esistente (oggi unit test e test con `WebApplicationFactory` su SQLite) resta lì e cosa si sposta.

- [ ] **B6. Punti aperti dell'anti-bot** — a richiesta
  - Honeypot accanto ad Altcha (con i limiti già emersi: il tempo minimo non ha senso con l'invio differito); memoria anti-replay per processo, da condividere (database) con più repliche; esenzione degli utenti autenticati dalla prova; taratura di `Altcha:MaxNumber` (300000) e della validità (10 minuti) dopo prove su telefoni lenti.

## C. Temi condizionati: si riaprono solo se cambia qualcosa

- [ ] **C1. Più repliche dell'app.** Se si passa a più di una replica si riaprono insieme: lock distribuito per i job in background (`EventiHostedService`, `ModerazioneHostedService`), memoria anti-replay di Altcha, coerenza della cache L1 (per processo), applicazione concorrente delle migrazioni (`docker.md`).
- [ ] **C2. Limite di richieste su `GetEventi`** (opzione 2 scartata il 2026-10-31): da valutare solo se servirà, oltre all'arrotondamento di `since` al minuto già fatto.
- [ ] **C3. Deroghe «da rivalutare» di `CLAUDE.md`:** MFA per gli admin e primo amministratore senza cambio password (se crescono gli admin o il rischio), client API scritti a mano (se gli endpoint crescono o servono client esterni), traduzioni (se serve l'inglese).

## D. Già annotate in altri piani (qui solo per memoria)
- Ricerca indirizzi tramite il server, con cache condivisa: evoluzione futura in `PLAN-gps.md`, da riconsiderare solo con blocchi o errori 429 di Nominatim.
- Valutazione di un'app React Native: passo C1 di `PLAN-gps.md`.
- Filtro «vicino a me» lato server: B3 di `PLAN-gps.md`, chiuso.
- Verifiche manuali dopo il deploy (email ai moderatori, sincronizzazione, PWA, menu, dettaglio su telefono): sezione «Da verificare dopo il deploy» di `PUNTI-APERTI.md`.
- Commit ancora da fare: `piano-commit.md`.
