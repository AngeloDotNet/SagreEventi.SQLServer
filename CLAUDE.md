# Istruzioni per Claude

Le regole generali sono in `.claude/rules/` (`core`, `backend`, `frontend`, `security`, `docker`, `git`) e nei moduli opzionali `.claude/rules-optional/backend-email.md` e `.claude/rules-optional/backend-infra.md` (solo la parte sulla cache). In caso di conflitto prevale questo file.

- All'inizio di un lavoro leggi `CHANGELOG.md`: riassume le modifiche passate e il contesto, evita di rileggere il codice già noto.
- Dopo ogni modifica al codice aggiungi in cima a `CHANGELOG.md` una voce breve (data, perché, file toccati, note/da fare).
- Quando esiste un plan di attività, svolgere gli step uno alla volta e attendere la conferma esplicita dell'utente prima di ogni modifica. Approvare il plan non equivale a dare il via a tutti gli step: dopo l'approvazione proporre lo step successivo e aspettare il "vai".
- Al termine di ogni step, se la build termina correttamente, registrare le modifiche in `CHANGELOG.md`.
- Quando si crea un piano (plan), salvarlo in un file `.md` dedicato nella cartella `docs/piani/` (spostata dalla root il 2026-11-02), con nome `PLAN-<nome>.md` (uno per attività), così che sia tracciato nel repository: i piani aperti si **committano** (decisione del 2026-11-01), con messaggio `docs(plan): ...` e solo su conferma come ogni commit; alla conclusione il file si cancella (con un commit a parte, o assorbito dallo squash se nato e concluso nello stesso branch). `CHECKLIST.md` e `piano-commit.md` restano fuori dai commit salvo richiesta. Questa convenzione prevale su `PIANO.md` di `core.md`. Quando un piano è concluso e non serve più, cancellare il suo file `PLAN-*.md`, anche se i commit non sono ancora stati fatti (quelli mancanti stanno in `piano-commit.md`): la storia resta in `CHANGELOG.md` (e i punti ancora aperti in `CHECKLIST.md`). Prima di cancellarlo, spostare altrove ciò che resta valido.
- I commit ancora da fare si tengono in `piano-commit.md` (root), aggiornato dopo ogni commit.

## Generale
- Definire il plan e salvarlo in un file `.md`
- Il plan va seguito step by step: ogni step richiede un OK esplicito prima di procedere
- **Commit:** solo locali e solo con conferma esplicita dell'utente, secondo `.claude/rules/git.md` (mostrare file e messaggio, attendere l'ok). Mai push, PR, tag o rilasci. Mai commit di iniziativa.
- In caso di dubbio, fare una domanda alla volta e non prendere iniziative.
- Aggiungere commenti in inglese ai metodi pubblici, se presenti nel codice in italiano o totalmente assenti, aggiungere i commenti in inglese corrispondenti.

## Scelte architetturali
Scelte concordate con l'utente il 2026-10-31, riviste il 2026-11-01 dopo l'aggiornamento delle regole in `.claude/`. Dove il codice attuale non le rispetta, valgono come **obiettivo per il codice nuovo**: nessuna migrazione senza piano dedicato e via libera. Fanno eccezione i punti con un piano di allineamento indicato nella tabella.

| Voce | Scelta |
|---|---|
| Lingua della documentazione | Italiano (`README.md`, `CHANGELOG.md`) |
| Branch | Git flow con `develop`: `feature/`, `bugfix/`, `release/` da `develop`, `hotfix/` da `main` |
| Architettura backend | Clean Architecture (`Domain`, `Application`, `Infrastructure`, `Api`). Oggi il backend è un solo progetto `SagreEventi.Web.Server`: la ristrutturazione è un'attività separata, da pianificare |
| Database e accesso ai dati | SQL Server + EF Core, senza Dapper. Licenza: SQL Server solo edizioni Express/Developer o licenza già in possesso del cliente |
| Gestione errori | `OperationResults` di Marco Minerva per il codice nuovo (scelta fissa delle regole dal 2026-11-01; la variante AppEngine è sospesa e non va usata). Verificato il 2026-10-31 (non ancora installato): pacchetti NuGet `OperationResultTools` (core) e `OperationResultTools.AspNetCore.Http` (Minimal API), versione 1.0.39, licenza MIT, `net10.0`, nessuna dipendenza esterna per il core; namespace `OperationResults` e `OperationResults.AspNetCore.Http` (il nome del pacchetto è diverso dal namespace). Al primo uso: `dotnet list package --vulnerable --include-transitive`, controllo licenze e verifica che gli errori escano come `ProblemDetails` con chiavi di traduzione (mapping personalizzato per 409, 412, 422) |
| Autenticazione | ASP.NET Core Identity con `AddIdentityApiEndpoints` (token bearer di Identity). La sezione `Jwt` di `security.md` non si applica |
| Autorizzazione | Ruoli fissi (`Ruoli`) e policy (es. `SoloAdmin`). Nessun permesso granulare, registrazione self-service, MFA o multi-tenancy. **Deroga a `security.md`** (MFA per i ruoli amministrativi, decisa il 2026-11-01): gli utenti amministrativi sono pochi e li crea l'amministratore, senza registrazione self-service. Da rivalutare se cresce il numero di admin o il rischio |
| Livello ASVS | 2 |
| Logging | Provider standard .NET tramite `ILogger`, su stdout. `traceId` propagato con header `X-Trace-Id`: **da implementare** con `PLAN-trace-id.md` (verificato il 2026-11-01: oggi non esiste né nel frontend né nel backend) |
| Cache | FusionCache solo L1 in memoria, nessun L2/Redis. Approvato il 2026-10-31 per la lettura pubblica degli eventi (`EfCoreEventiService`): durata 5 minuti (esplicita), fail-safe attivo (massimo 5 minuti, throttling 5 minuti, jitter 30 secondi), invalidazione per tag `eventi` dopo conclusione, scrittura e revisione. Con più repliche la coerenza è eventuale (fino a 5 minuti, L1 è per processo). Ogni nuova cache o configurazione avanzata: chiedere prima |
| Job in background | `BackgroundService` periodici (`PeriodicTimer`): `EventiHostedService` (chiusura degli eventi scaduti) e `ModerazioneHostedService` (avviso email ai moderatori). Entrambi idempotenti, senza retry né lock distribuito. **Deroga a `backend.md` §5b** (lock distribuito), valida finché l'app gira con **una sola replica**: con più repliche ogni replica manderebbe la propria mail, quindi serve prima un lock (chiedere come). Il retry dell'avviso moderazione è implicito: la segnalazione è marcata `NotificataIl` solo dopo almeno una consegna, quindi un fallimento si riprova al ciclo successivo. Per nuovi job chiedere tipo, strumento e retry |
| Email | Deciso il 2026-11-01 (stato attuale, secondo `backend-email.md`): MailKit (MIT) dietro `IEmailSender`, implementazione `MailKitEmailSender`; invio non bloccante dal job `ModerazioneHostedService`, nessuna coda RabbitMQ e nessun outbox (un'email persa si riprova al ciclo successivo, vedi «Job in background»). Test e sviluppo (regola aggiornata il 2026-11-01): Mailtrap non è più previsto dalle regole; per i test che richiedono un mail server il default è **Mailpit**, istanza esterna già presente (non va nel compose), solo in sviluppo e test, con `Smtp__Security=None`; licenza da verificare sul repository ufficiale al primo uso. Oggi i test usano `FakeEmailSender` e lo sviluppo Mailpit tramite `Smtp__*`; in produzione un SMTP reale con TLS. Link costruiti da `App:PublicBaseUrl`, mai dall'header `Host`. Per un outbox o un retry con backoff: chiedere prima |
| Esposizione OpenAPI | Solo in Development |
| Backup database | Già coperto sul server: nessun servizio `db-backup` |
| Healthcheck | Nessuno. Non è più una deroga: dal 2026-11-01 `core.md`, `docker.md` e `security.md` prevedono l'assenza di healthcheck (decisione del 2026-10-31 recepita dalle regole). Niente `HEALTHCHECK` nei Dockerfile, niente `healthcheck` né `depends_on` nel compose, niente endpoint `/healthz`. Se servirà un controllo di salute, chiedere all'utente prima di reintrodurlo |
| Migrazioni | Applicate dal backend all'avvio del container con `Database.MigrateAsync()` (solo SQL Server), controllate dal flag `Database:MigraAllAvvio` (`true` in `appsettings.json` e `deploy/.env.example`), come prevede `backend.md` §4.4 aggiornato il 2026-11-01. Nessun servizio one-shot né bundle. Con più repliche l'applicazione concorrente va evitata (`docker.md`): oggi una sola replica |
| Primo amministratore | **Deroga a `backend.md` §7** (decisa il 2026-11-01): Admin ed Editor sono creati all'avvio da `IdentitySeedHostedService`, dalla configurazione `Identity:Admin` e `Identity:Editor`, invece che da uno step one-shot, e senza cambio password obbligatorio al primo accesso. Motivo: due utenti iniziali creati dal gestore stesso, il cambio password forzato richiederebbe campo utente con migrazione, blocco lato server, pagina e guard nel frontend e relativi test. Restano le cautele attuali: creazione idempotente, password di esempio rifiutate fuori da Development, nessuna password nei log. Da rivalutare se gli admin diventano molti |
| Mock EF nei test unitari | No (default del template, `backend-app.md` §4.5): nessun mock di `DbContext` o `DbSet`. Un servizio che legge dal `DbContext` si prova sul database reale di prova; il mock vale solo per la logica che non tocca il `DbContext` e va dichiarato qui prima dell'uso |
| Validazione | Deroga a `backend.md` (decisa il 2026-10-31): niente FluentValidation. Si tiene `Validation/EventoValidator.cs` con le Data Annotation di `EventoModel` (la cartella diventa `Validators/` con `PLAN-allineamento-backend.md`). Per nuovi validatori seguire lo stesso schema; se servirà FluentValidation, chiedere prima (pacchetto e licenza da verificare) |
| Versionamento API | Deroga a `backend.md` (decisa il 2026-10-31): niente `Asp.Versioning`, gli endpoint restano senza versione (`/api/eventi`). L'API serve solo la PWA, deployata insieme al backend. Se servissero client esterni o versioni in parallelo, chiedere prima |
| Swagger UI | Deroga a `backend.md` (decisa il 2026-10-31): nessuna interfaccia grafica per l'OpenAPI, che in Development resta esposto solo come documento (verificato dai test). Se servirà una UI, chiedere prima quale (pacchetto e licenza da verificare) |
| Registrazione dei servizi | Deroga a `backend.md` (decisa il 2026-10-31): niente Scrutor, una riga esplicita per servizio in `ServiceCollectionExtensions.cs`. Se i servizi diventassero molti, chiedere prima |
| Traduzioni frontend | Deroga a `frontend.md` e `core.md` §1 (decisa il 2026-10-31): nessuna libreria di traduzione, l'app è solo in italiano e i testi stanno nei template. Se servirà l'inglese, chiedere prima quale libreria (licenza da verificare) e pianificare l'estrazione dei testi |
| Client API frontend | Deroga a `core.md` §1 e `frontend.md` §2 (decisa il 2026-11-01): client e modelli TypeScript scritti a mano, non generati dallo schema OpenAPI. Motivo: l'API serve solo la PWA, è piccola e l'OpenAPI è esposto solo in Development. Da rivalutare se gli endpoint crescono o servono client esterni (in quel caso chiedere prima quale generatore, licenza da verificare) |
| Security headers | Oggi l'API manda solo `nosniff` e HSTS (fuori da Development) e l'nginx del frontend solo `nosniff`: mancano CSP, `Referrer-Policy`, `Permissions-Policy` e `frame-ancestors` (`security.md`). **Da allineare** con `PLAN-security-headers.md` (deciso il 2026-11-01); la CSP del frontend, servito come file statici, si farà con hash degli inline noti, non con nonce, dopo la verifica di fattibilità del piano |
| CI e supply chain | Oggi solo `.github/workflows/build-push.yml`. **Da allineare a fasi** con `PLAN-ci-supply-chain.md` (deciso il 2026-11-01; repository pubblico): Dependabot e CI su PR, poi CodeQL e gitleaks, poi Trivy e SBOM. Ciò che non si farà diventa una deroga annotata qui. Esecuzione delle pipeline, push e segreti restano all'utente |
| Struttura delle cartelle del backend | Non è una deroga: i MUST di `backend.md` §2 sulle cartelle `Interfaces/` (punto 36), `Validators/` (39) e `Requests/` e `Responses/` (41), più expression body (37) e using inutilizzati (38), sono oggi non rispettati dal codice esistente e si allineano con `PLAN-allineamento-backend.md` (deciso il 2026-11-01). Il codice nuovo li rispetta già da ora |
| Moduli opzionali | `backend-email` incluso; `backend-infra` incluso **solo per la sezione sulla cache** (deciso il 2026-11-01: messaggistica RabbitMQ, outbox ed eventi di dominio non inclusi); `feature-workflow` non incluso |

## Note per Claude
- Il nome del file del piano e del changelog segue questo file, non `core.md` (`docs/piani/PLAN-<nome>.md`, `CHANGELOG.md`).
- `backend-infra.md` è incluso solo per la sezione sulla cache: il progetto usa già FusionCache (scelte approvate nella riga «Cache» della tabella). Per ogni nuova cache, o per una configurazione avanzata diversa da quella approvata, chiedere all'utente prima di procedere (FusionCache L1 o `IMemoryCache`, TTL esplicito, invalidazione dopo `SaveChanges`).
- Prettier (deciso il 2026-10-31): configurato (`.prettierrc.json`, script `format:check` e `format`) ma non imposto: il codice esistente non è formattato con Prettier e non si riformatta di iniziativa. Sui file nuovi o toccati si può usare `npx prettier --write <file>`; la riformattazione generale è un lavoro a sé (commit dedicato dopo i commit in sospeso).
- Data Protection (deciso il 2026-10-31, rivisto il 2026-11-01): nessuna cifratura a riposo delle chiavi, che restano in chiaro come da impostazione predefinita. Oggi l'app non configura una persistenza delle chiavi, quindi a ogni riavvio del container i token bearer e di rinnovo non sono più validi e gli utenti rifanno il login. **Deciso di persistere le chiavi nel database** (non su volume Docker), con `PLAN-data-protection.md`; finché il piano non è eseguito vale il comportamento attuale. Con la tabella delle chiavi nel database, backup e accessi vanno trattati come per il resto dei dati sensibili.
- Controllo licenze (deciso il 2026-10-31, da eseguire a mano prima di ogni release; verificato lo stesso giorno: nessuna licenza fuori lista a parte le eccezioni sotto):
  - NuGet: `dotnet tool install nuget-license --version 4.0.18 --tool-path <cartella>` (Apache-2.0), poi `<cartella>/nuget-license -i SagreEventi.sln -t -a "MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;MS-PL" -ignore "Microsoft.Data.SqlClient.SNI.runtime;Microsoft.Identity.Client.NativeInterop;xunit.abstractions"`.
  - npm (da `src/SagreEventi.Web`): `npx license-checker-rseidelsohn@5.0.1 --excludePrivatePackages --excludePackages "primeng@21.1.10;caniuse-lite@1.0.30001819;spdx-exceptions@2.5.0" --onlyAllow "MIT;MIT-0;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;0BSD;BlueOak-1.0.0;CC0-1.0;Python-2.0"` (BSD-3-Clause).
  - Eccezioni approvate: `Microsoft.Data.SqlClient.SNI.runtime` e `Microsoft.Identity.Client.NativeInterop` (librerie native Microsoft del driver SQL Server, termini Microsoft gratuiti, nessuna alternativa); `caniuse-lite` (CC-BY-4.0) e `spdx-exceptions` (CC-BY-3.0), dati usati solo in build; `xunit.abstractions` (Apache-2.0, solo test) e `primeng` (MIT, indicato come «Custom»), riconosciuti male dagli strumenti. Una licenza nuova o sconosciuta si segnala, non si ignora.
- Immagini Docker (deciso il 2026-10-31, rivisto il 2026-11-01): nessun digest `tag@sha256`, solo tag. Le immagini **base** dei Dockerfile oggi usano tag di versione maggiore o mobili (`dotnet/sdk:10.0`, `dotnet/aspnet:10.0`, `node:22-alpine`, `nginx-unprivileged:stable-alpine`): vanno fissate a tag precisi con `PLAN-tag-docker.md` (come chiede `docker.md`: «mai `latest`»). **Deroga a `docker.md`**: le immagini dell'app nei compose di `deploy/` (`sagreeventi-api`, `sagreeventi-web`) restano `:latest`, perché le pubblica la CI e le aggiorna la pipeline di deploy dell'utente.
- ADR (deciso il 2026-10-31): nessun ADR per le deroghe alle regole (Clean Architecture non applicata, niente Scrutor): la tabella «Scelte architetturali» di questo file è il registro delle decisioni. Una nuova deroga si annota lì.

## Lavoro da pianificare (MUST del template non ancora rispettati)
Allineamento del 2026-11-06 alle regole aggiornate del template (decisione D5: si annota, senza adeguare il codice di iniziativa). Ogni voce diventa un piano `PLAN-*.md` quando si decide di chiuderla.
- **Utente DDL separato per le migrazioni** (`backend-app.md` §4.4): oggi `Database.MigrateAsync()` usa la stessa connessione dell'app. Non rispettato.
- **Iterazioni PBKDF2 delle password** (`security.md`, «Dati e Segreti»): oggi il default di ASP.NET Core Identity (100.000), sotto i 220.000 indicati. Non rispettato: da impostare con `PasswordHasherOptions.IterationCount` letto dalla configurazione, con benchmark.
- **Header `Server`** (`security.md`, «Configurazione e superficie esposta»): da verificare. Kestrel invia `Server: Kestrel` se non è disattivato con `AddServerHeader = false`.
- **`Cache-Control: no-store` sulle risposte autenticate** (`backend.md` §2, `security.md`): oggi solo su un endpoint (`Endpoints/EventiEndpoints.cs`). Da estendere a livello di gruppo. Parziale.
- **`pageSize` con massimo imposto dal server** (`backend-app.md` §4.3): non trovato nel codice dell'endpoint di lista. Da verificare.
- **`SECURITY.md` e `docs/runbook-sicurezza.md`** (`security.md`, «Segnalazioni e risposta agli incidenti»; `core.md` §0b): non presenti. Contatti e tempi li fornisce l'utente.
- **Threat model leggero (ADR) per le funzionalità sensibili** (`core.md` §0b, `security.md`): regola di processo. Da applicare alle prossime funzionalità che toccano autenticazione, dati personali, upload o integrazioni esterne.

## Qualità del codice
- Seguire i principi SOLID
- Seguire le convenzioni di codifica e gli standard del progetto, inclusi i naming convention, la formattazione, le regole di stile e le best practice del linguaggio utilizzato
- Manutenibile e leggibile
- Nullable reference types abilitati
- Evitare astrazioni non necessarie e overengineering
- Privilegiare la semplicità ogni volta che è possibile
- Scrivere codice testabile e coperto da test automatizzati (unit test e integration test)

## Sicurezza
- Considerare sempre la sicurezza: prevenire le vulnerabilità OWASP Top 10 (injection, broken access control, ecc.)
- Proteggere da injection: SQL/NoSQL (query parametrizzate, mai concatenare input), command, LDAP, XSS, header/log injection, path traversal, SSRF, deserializzazione non sicura
- Validare e sanificare ogni input esterno (anche header, query string, route, body)
- Mai esporre dettagli interni (stack trace, messaggi di eccezione) nelle risposte fuori da Development
- Nessun segreto o credenziale nel codice o nei log; confronti di credenziali a tempo costante
- Usare solo API crittografiche moderne e non obsolete
- Tenere i pacchetti NuGet privi di vulnerabilità note (`dotnet list package --vulnerable --include-transitive`)
- Ogni modifica che tocca input, autenticazione o dati va verificata con test di sicurezza (es. input malevoli)

## Eccezioni alle regole globali
- **Integrazione GitHub approvata:** PR no, push no, tag no, rilasci no (2026-11-06)
