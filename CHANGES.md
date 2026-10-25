# Registro modifiche al codice

Riassunto compatto delle modifiche fatte con Claude, così non serve rileggere i file per ricostruire il contesto.
Ordine: più recente in alto. Una voce per intervento: cosa, dove (file), perché.

## 2026-10-25 — Commit del lavoro e rimozione dei file di piano

**Perché:** richiesta dell'utente: committare in più commit per area (push e PR a cura dell'utente) e togliere i piani, ormai completati.

**Cosa:** 8 commit su `main`: rimozione Blazor, OpenAPI nativo, entità e moderazione, Identity, endpoint Minimal API, Docker, documentazione, rimozione dei piani. Eliminati `PLAN-migrazione-backend.md` e `PLAN-moderazione-eventi.md`; tolti i riferimenti da `SagreEventi.sln`, `README.md` (struttura) e `SOSPESI.md`. Il dettaglio dei piani resta in questo file e in git (commit `55e9cea` e precedenti).

**Note:** i commit intermedi probabilmente non compilano da soli (codice intrecciato); lo stato finale sì. `CLAUDE.md` chiede ancora di salvare i piani in `PLAN-<nome>.md`: la regola vale per i piani futuri. Nessun push.

## 2026-10-25 — Nuovo SOSPESI.md

**Perché:** richiesta dell'utente: salvare in un file dedicato ciò che resta sospeso dopo i piani.

**Cosa:** `SOSPESI.md` (prove manuali Docker/browser/SQL Server, azioni di configurazione e dati, limiti noti); aggiunto ai Solution Items di `SagreEventi.sln`. Solo documentazione.

## 2026-10-25 — README allineato allo stato attuale

**Perché:** richiesta dell'utente. Il README era già quasi allineato; mancavano esempio JSON e struttura.

**Cosa:** `README.md`: esempio JSON con `stato` (solo output) e limiti di lunghezza dei campi; «Project structure» con `Endpoints/`, `Extensions/`, `HostedServices/`, `Migrations/`, `PLAN-*.md`, `TEST-MANUALI.md`, `CHANGES.md`, feature `segnalazioni` e `gestione`.

**Note:** solo documentazione, nessun codice toccato.

## 2026-10-23 — Revisione eventi: scheda «Conclusi» solo per l'Admin

**Perché:** richiesta dell'utente: oltre a In attesa, Rifiutati e Approvati, l'Admin deve poter vedere anche gli eventi conclusi/scaduti.

**Cosa:** nuovo `GET /api/Eventi/Revisione/Conclusi` (`RevisioneEndpoints`, policy `SoloAdmin` oltre a quella del gruppo; Editor → 403, anonimo → 401): tutti gli eventi con `EventoConcluso` in qualunque stato (scaduti e ritirati), con nota di rifiuto, per data di fine decrescente, massimo 200. `IEventiService.GetConclusiAsync` + `EfCoreEventiService`. Angular: `RevisioneService.conclusi()`; `revisione.page.ts` mostra la scheda «Conclusi» solo se `eAdmin()`, in sola lettura (niente checkbox né azioni), con colonne Stato e Nota. Nessuna modifica al modello EF. Test: 2 nuovi in `EventiApiTests` (accesso solo Admin; contenuto in ogni stato, aperti esclusi). `README.md`: riga endpoint e frase nella sezione Moderation.

**Note:** 154/154 test, `ng build --configuration production` ok. La build della soluzione intera non è stata rifatta perché l'API era in esecuzione (file `.exe` bloccato): test eseguiti con `-p:UseAppHost=false`. Riavviare l'API per vedere la scheda. Non toccati `appsettings*.json`.

## 2026-10-23 — Step 9: documentazione (README) e test manuali

**Perché:** ultimo step del piano; il README descriveva ancora l'avvio senza Docker e non citava proxy, header inoltrati, `/healthz` e test.

**Cosa:** `README.md`: sezione «Tests» (`dotnet test`, controllo pacchetti vulnerabili), sezione «Docker» (4 servizi, `.env`, certificato, `docker compose up --build`, variabili, sicurezza del proxy, avviso «non ancora provato»), tabella configurazione con `ForwardedHeaders:*`, `AllowedHosts`, `Cors:Origins` (voci vuote ignorate) e variabili d'ambiente con `__`, riga `/healthz` negli endpoint, struttura del progetto con `deploy/`, `tests/`, compose, voci «scope» e «What's next» aggiornate. Nuovo `TEST-MANUALI.md`: checklist delle prove da fare a mano (preparazione, build, HTTPS, frontend, login, limiti nginx 413/XFF/host, persistenza, segreti, deploy senza Docker). `SagreEventi.sln`: `TEST-MANUALI.md` nei Solution Items.

**Note:** solo documentazione, nessun codice toccato. **Piano completato (step 0-9).** Resta da fare a mano `TEST-MANUALI.md`.

## 2026-10-23 — Step 8: Docker con nginx dedicato (file scritti, immagini non provate)

**Perché:** deploy in Docker con nginx come reverse proxy in un container dedicato, stessa origine (decisione presa con S4).

**Cosa:** 4 servizi in `docker-compose.yml`: `sqlserver` (volume, healthcheck), `api` (porta 8080 solo `expose`, migrazioni all'avvio, seed Admin da `.env`, `AllowedHosts=SERVER_NAME`, `ForwardedHeaders__KnownNetworks__0` = subnet fissa 172.28.0.0/24 della rete `interna`), `web` (Angular + `nginxinc/nginx-unprivileged`, fallback SPA, cache dei file con hash), `proxy` (`deploy/nginx`: HTTPS TLS1.2/1.3 con certificati montati da `deploy/certs`, 80→301 a HTTPS, `/api/`→`api:8080`, `/`→`web:8080`, `client_max_body_size 5m`, `X-Forwarded-For $remote_addr` (non `$proxy_add_x_forwarded_for`: il valore del client non passa mai), HSTS e header di sicurezza, `limit_req` grossolano). Dockerfile API: multi-stage sdk→aspnet, utente non root, healthcheck solo con bash su `/healthz`. Codice: `AddHealthChecks` + `MapHealthChecks("/healthz")`; CORS ignora le origini vuote (in Docker `Cors__Origins__0=""` azzera l'origine di esempio) e le legge in modo pigro. `.gitignore`: `deploy/certs/`, `.env`. Test nuovi: `HealthTests`, `CorsTests` (3).

**Note:** build 0 errori e 0 avvisi, 152/152 test, `ng build --configuration production` e `dotnet publish` ok. **Docker non è installato qui: immagini, compose e nginx.conf NON sono stati costruiti né provati** (sintassi scritta a mano). Da fare a mano: certificato (vedi `.env.example`), `.env`, `docker compose up --build`, poi le prove nel piano (413 oltre 5 MB, XFF falso, host errato). Prossimo: 9 (README).

## 2026-10-23 — Step 7-quater: nullable reference types abilitati

**Perché:** regola di `CLAUDE.md` ("Nullable reference types abilitati"); `Shared` e `Web.Server` avevano `<Nullable>disable</Nullable>`.

**Cosa:** `<Nullable>enable</Nullable>` in `SagreEventi.Shared.csproj` e `SagreEventi.Web.Server.csproj`. Annotazioni oneste: `string?` per `MotivoRifiuto` (DTO ed entità), `RevisionatoDa`, `RifiutaEventiRequest.Motivo`, `motivo` di `IEventiService.RifiutaAsync`/`EfCoreEventiService`, `ids` di `GetStati`, campi dei body admin (`CreaUtenteRequest`/`ModificaUtenteRequest`, `Valida`) e `ValidaIds`; `= string.Empty` per le stringhe sempre valorizzate (`Id`, `NomeEvento`, `CittaEvento`, `DescrizioneEvento`, `StatoEventoModel.Id`), `= new()` in `FusionCacheOptions`. Tolti i `?.` ridondanti sul body non nullable negli endpoint admin e revisione. Test: corretti i 4 avvisi preesistenti in `AdminUtentiTests`; `SicurezzaInputTests` ha 11 casi nuovi (body senza campi o con `null` → 400, evento con testi `null` → 400) e il token Admin è ottenuto una volta per factory (limite di 10 login/minuto).

**Verifica:** `dotnet ef migrations has-pending-model-changes` prima e dopo: nessuna modifica al modello, nessuna nuova migrazione. Contratto JSON invariato.

**Note:** build 0 errori e 0 avvisi, 148/148 test. Prossimo: 8 (Docker con nginx), poi 9.

## 2026-10-23 — Sicurezza S6: test con input malevoli, escape JSON e nosniff (chiude lo step 7-sec)

**Perché:** ultimo punto della verifica sicurezza di CLAUDE.md: provare l'API con input ostili e non solo con quelli attesi.

**Cosa:** nuovo `SicurezzaInputTests` (17 casi): SQL injection (campi evento, id, `GetStati`, `since`, login, revisione, id utente), payload `<script>` solo come dato JSON, body malformati / `[null]` / data non valida → 400 senza stack trace né nomi interni, email con newline o malformata rifiutata, id utente con path traversal → 404. Il test sullo script ha trovato che le risposte JSON non escapavano `<`/`>`: `ServiceCollectionExtensions` imposta `JsonOptions.Encoder = JavaScriptEncoder.Default` (escape; per i client JSON nulla cambia) e `Program.cs` aggiunge `X-Content-Type-Options: nosniff` a tutte le risposte. Piano: 7-sec completato.

**Note:** build 0 errori, 138/138 test. Non coperto dai test: limite del corpo di 5 MB (Kestrel, non simulabile con il test server). Prossimo: 7-quater (nullable), poi 8 (Docker, con nginx) e 9.

## 2026-10-23 — Sicurezza S5: politica password, id di GetStati, AllowedHosts (step 7-sec)

**Perché:** verifica sicurezza di CLAUDE.md: password minime di soli 6 caratteri, id di `GetStati` senza lunghezza massima, `AllowedHosts` aperto.

**Cosa:** `IdentityServices`: `Password.RequiredLength = MinPasswordLength` (10; restano le regole predefinite di Identity su maiuscole/minuscole/cifre/simboli), vale per `/api/admin/utenti` e per gli endpoint `/api/auth`. `EventiEndpoints.GetStatiAsync`: `400` se un id supera `EventoModel.MaxIdLength` (100). `AllowedHosts` non modificato (`appsettings.json` non si tocca): in produzione si imposta con la variabile d'ambiente, annotato nel piano per lo step 8. Test: password troppo corta (`AdminUtentiTests`), troppi id / id troppo lunghi / id al limite (`EventiApiTests`).

**Note:** build 0 errori, 121/121 test. Le password già esistenti non sono toccate: la regola vale per le nuove. Resta S6 (test con input malevoli).

## 2026-10-23 — Sicurezza S4: supporto al reverse proxy nginx (step 7-sec)

**Perché:** in produzione davanti all'API ci sarà nginx (Docker): senza gestire gli header `X-Forwarded-*` tutti i client risultano lo stesso IP (i rate limit per IP li bloccherebbero a gruppi) e lo schema HTTPS non è visibile (HSTS/redirect).

**Cosa:** backend: `ServiceCollectionExtensions.ConfiguraForwardedHeaders` (X-Forwarded-For e -Proto, `ForwardLimit` 1; proxy fidati da `ForwardedHeaders:KnownProxies` e `ForwardedHeaders:KnownNetworks` in CIDR; senza configurazione vale solo il loopback e gli header sono ignorati, quindi nessuno spoofing dell'IP) e `app.UseForwardedHeaders()` come primo middleware in `Program.cs`. Frontend: `config.service.ts` ora ha `apiBaseUrl` di default `""` (stessa origine, come nginx che serve il frontend e inoltra `/api`); `public/config.json` era già `""`. Nuovo `ForwardedHeadersTests` (proxy fidato: limite per client reale; non fidato: header ignorato). Piano: S4 segnato fatto, topologia nginx descritta nello step 8.

**Note:** build 0 errori, 117/117 test, `ng build` ok. In compose servirà `ForwardedHeaders__KnownNetworks__0` con la subnet Docker (step 8). Nessuna modifica ad `appsettings*.json`. Restano S5-S6.

## 2026-10-23 — Sicurezza S3: HSTS fuori da Development (step 7-sec)

**Perché:** verifica sicurezza di CLAUDE.md: mancava l'header `Strict-Transport-Security`, che impedisce ai browser di tornare su HTTP.

**Cosa:** `Program.cs`: `app.UseHsts()` fuori da Development, prima di `UseHttpsRedirection` (opzioni predefinite: 30 giorni; l'header viene emesso solo su richieste HTTPS e non per localhost). Nuovo `HstsTests` (Production → header con `max-age`; Development → nessun header).

**Note:** build 0 errori, 115/115 test. Dietro un proxy che termina l'HTTPS servirà `ForwardedHeaders` (S4/step 8) perché il server veda lo schema HTTPS. Restano S4-S6.

## 2026-10-23 — Sicurezza S2: niente utenti seed con password di esempio fuori da Development (step 7-sec)

**Perché:** `appsettings.json` contiene Admin/Editor con password note (`Admin!12345`, `Editor!12345`): su un server dove nessuno le sostituisce sarebbero stati creati account con credenziali pubbliche.

**Cosa:** `IdentitySeeder.CreaUtenteAsync` non crea l'utente se l'ambiente non è Development e la password è una di quelle di esempio; scrive un avviso nel log (senza la password). Nessuna modifica ad `appsettings*.json`. Nuovo `SeedSicurezzaTests` (Production/Testing → utente non creato; Development → creato; password propria in Production → creato).

**Note:** build 0 errori, 113/113 test. Attenzione: chi avvia in Production senza `appsettings.local.json` o variabili d'ambiente non avrà più Admin/Editor di esempio (voluto). Restano S3-S6.

## 2026-10-23 — Sicurezza S1: lunghezze massime sui campi dell'evento (step 7-sec)

**Perché:** verifica sicurezza di CLAUDE.md: l'insert anonimo accettava testi di dimensione arbitraria (colonne `nvarchar(max)`, solo il limite di 5 MB per richiesta) e un `Id` oltre 450 caratteri dava 500.

**Cosa:** `[StringLength]` su `EventoModel` con costanti pubbliche (`MaxIdLength` 100, `MaxNomeLength` 200, `MaxCittaLength` 100, `MaxDescrizioneLength` 4000, gli stessi limiti del form Angular); applicati dal validatore esistente → `400`. Nessuna migrazione né modifica al DB. Piano: nuovo step 7-sec (S1-S6) prima di 7-quater. Test in `EventiApiTests`: campi oltre il limite rifiutati (4 casi), campi esattamente al limite accettati.

**Note:** build 0 errori, 109/109 test. Restano S2-S6 (password di esempio, HSTS, ForwardedHeaders, politica password/AllowedHosts/id di GetStati, test con input malevoli), ognuno dopo il "vai".

## 2026-10-23 — Commenti interni `//` tradotti in inglese

**Perché:** completare l'allineamento delle lingue dei commenti richiesto dall'utente (dopo i commenti XML).

**Cosa:** tradotti in inglese i commenti `//` italiani in `EventoModel`, `AdminUtentiEndpoints`, `EventiEndpoints`, `RevisioneEndpoints`, `IdentitySeeder`, `IdentityServices`, `OpenApiServices`, `ServiceCollectionExtensions`, `EventiHostedService`, `EfCoreEventiService`, `Program` e nei test (`AdminUtentiTests`, `ApiFactory`, `EventiApiTests`, `ScadenzaEventiTests`). Solo commenti: nessuna modifica al comportamento. Non toccati Angular e Migrations.

**Note:** build 0 errori, 104/104 test. Gli avvisi nullable nei test (`AdminUtentiTests`) sono preesistenti e rientrano nello step 7-quater. Verifica sicurezza (CLAUDE.md) eseguita solo in lettura: esiti riportati all'utente, nessuna correzione applicata.

## 2026-10-23 — Commenti XML in inglese sui metodi pubblici

**Perché:** regola di CLAUDE.md: i metodi pubblici hanno un commento in inglese; quelli presenti in italiano vanno tradotti.

**Cosa:** aggiunti `/// <summary>` in inglese ai metodi pubblici che ne erano privi (`Map*Endpoints`, `Add*Services`, `ToEntity`, `Intervallo`, `StartAsync`/`StopAsync`, `ExecuteAsync`, `Main`, `GetFusionCacheDefaultOptions`) e `/// <inheritdoc />` sulle implementazioni di `IEventiService` in `EfCoreEventiService`; tradotti in inglese i commenti XML italiani esistenti (endpoint, `Extensions`, `EventoMappings`, `EventoValidator`, `ScadenzaEventiOptions`, `EventiHostedService`, `Evento`, `Ruoli`/`Policies`, `IEventiService`, `RevisioneModels`, `StatoModerazione`). Solo commenti: nessuna modifica al comportamento.

**Note:** i commenti `//` interni e i test restano com'erano; build 0 errori/0 avvisi, 104/104 test.

## 2026-10-23 — Step 7-ter: scadenza automatica, rifiuto senza comunicazione, home a tutta larghezza

**Perché:** la conclusione di un evento non è più una scelta degli utenti ma la decide il server; un rifiuto non va comunicato a chi ha segnalato (la nota resta solo come storico per lo staff); testo della home a tutta larghezza.

**Backend:**
- `HostedServices/EventiHostedService.cs` riscritto come `BackgroundService` con `PeriodicTimer` (un ciclo alla volta, parte subito, errori registrati senza fermarlo). Intervallo da `Eventi:ScadenzaIntervalloMinuti` (default 60, frazioni ammesse) letto con `IOptionsMonitor` + `OnChange`: vale anche a caldo. Nuova `Options/ScadenzaEventiOptions.cs`; registrazione in `ServiceCollectionExtensions.cs` (`Configure` + `AddHostedService`, alias di `using` per evitare il conflitto col namespace `Options`).
- `EfCoreEventiService`: `ConcludiScadutiAsync` (aggiornamento mirato `ExecuteUpdateAsync`: solo gli eventi non ancora conclusi con `DataFineEvento` < oggi UTC, imposta `DataOraUltimaModifica`, invalida la cache) al posto di `GetEventiScadutiAsync` + `UpdateEventoAsync` (rimossi da `IEventiService`). Un evento già concluso sul server è ignorato in `UpdateEventiAsync` da tutti, Admin compreso; `ApplyFrom` non copia più `EventoConcluso` dal client e `StessoContenuto` non lo confronta.
- Rifiuto: `Motivo` facoltativo in `RevisioneEndpoints` (max 500 se presente; vuoto → `MotivoRifiuto = null`). `GetStatiAsync` restituisce `InAttesa` per un evento rifiutato e non espone più la nota: rimosso `MotivoRifiuto` da `StatoEventoModel` (`SagreEventi.Shared`).
- Test: `ScadenzaEventiTests.cs` (nuovo: conclusione dei soli scaduti, timestamp, non rielaborazione, conteggio, pull incrementale + cache, evento in attesa scaduto, servizio in background con intervallo a caldo), `EventiApiTests.cs` (client non può concludere, concluso non modificabile né riapribile, rifiuto senza motivo, ritiro senza motivo, `GetStati` nasconde il rifiuto), `EventoMappingsTests.cs`.

**Angular:** rimossi "Segna come concluso" (`chiediConclusione`), `EventiStore.concludi` e `rimuoviSegnalazione`; `mie-segnalazioni.page.ts` mostra sempre «In attesa di approvazione» (niente tag «Rifiutata», motivo, «Rimuovi dal dispositivo»); dettaglio evento: un `Rifiutato` locale appare come in attesa; `revisione.page.ts`: nota facoltativa (pulsante sempre attivo, testo aggiornato, colonna «Nota»); `core/models.ts`, `revisione.service.ts` (motivo vuoto non inviato). Home: tolto `max-width: 46ch` da `.hero-testo` in `styles.css`. `README.md` aggiornato.

**Verifica:** `dotnet build` 0 errori, `dotnet test` 104/104, `ng build` ok. Non provato nel browser né su SQL Server reale (`ExecuteUpdateAsync` provato solo su SQLite).

**Note/da fare:** `Eventi:ScadenzaIntervalloMinuti` non è in `appsettings.json` (non toccato per vincolo): vale il default 60. Una segnalazione rifiutata resta «in attesa» per sempre sul dispositivo di chi l'ha fatta (scelta voluta). Le vecchie copie locali con stato `Rifiutato` sono mostrate come in attesa e riallineate alla prossima sincronizzazione. Restano 8 (Docker) e 9 (documentazione).

## 2026-10-23 — Menu: Revisione e Amministrazione raggruppate in "Gestione"

**Perché:** un Admin aveva 7 voci nella barra mobile; le due sezioni di gestione ora sono una sola voce con schede.

**Dove:** `features/gestione/gestione.page.ts` (nuovo, barra schede Revisione (n) / Utenti, Utenti solo Admin), `app.routes.ts` (`/gestione` con figlie `revisione` e `utenti`; `/revisione` e `/amministrazione` ora sono redirect), `app.ts` (voce unica "Gestione (n)" per chi può modificare), `README.md` (percorsi).

**Verifica:** `ng build` ok. Non provato nel browser.

**Aggiunta:** testo introduttivo di Revisione e Utenti a tutta larghezza: `.pagina-intro` aveva `max-width: 60ch`; nuova classe `.larga` in `styles.css` (`max-width: none`) applicata solo a queste due pagine.

## 2026-10-23 — Step 7-bis: sezione Amministrazione (gestione utenti)

**Perché:** finora gli utenti si creavano solo dal seed; l'Admin deve poterli gestire dall'interfaccia.

**Backend:**
- `Endpoints/AdminUtentiEndpoints.cs` (nuovo, registrato in `Program.cs`), gruppo `/api/admin` con policy `SoloAdmin` (nuova in `Models/Identity/Ruoli.cs` e `IdentityServices.cs`): `GET ruoli` (sola lettura, Admin/Editor fissi), `GET utenti`, `POST utenti` (email, password, ruoli → 201), `PUT utenti/{id}` (email = anche username, password opzionale, `ruoli` sostituisce l'insieme), `DELETE utenti/{id}` (204).
- Validazione: email valida ≤256, ruoli solo quelli esistenti, regole password di Identity (400 con ValidationProblem; email duplicata → 400). Salvaguardie → 409: non cancellarsi, non togliersi Admin, non rimuovere/cancellare l'ultimo Admin. Un cambio di ruoli aggiorna il security stamp (il refresh token vecchio non vale più).
- `tests/.../AdminUtentiTests.cs` (nuovo): 401/403 su ogni endpoint, creazione e validazioni, modifica (login con nuova email/password), 404, salvaguardie, cancellazione. **82/82** test.

**Angular:** `core/admin-utenti.service.ts` (client + `messaggioErroreApi`), `features/amministrazione/amministrazione.page.ts` (tabella, dialog crea/modifica con multiselect ruoli, conferma di eliminazione), guard `richiedeAdmin` in `permessi.service.ts`, rotta `/amministrazione`, voce di menu solo per Admin (`app.ts`). `README.md` aggiornato.

**Verifica:** `dotnet build` 0/0, `dotnet test` 82/82, `ng build` ok. Non provato nel browser.

**Note/da fare:** gli access token già emessi restano validi fino a scadenza anche dopo un cambio ruolo o una cancellazione (la durata è quella di Identity, 1 ora); i refresh token no. Non esistono endpoint separati per assegnare/revocare un ruolo: lo fa il `PUT` con l'elenco completo. Restano 7-ter, 8, 9.

## 2026-10-23 — Moderazione M6: ritiro dalla pagina di revisione e chiusura

**Perché:** completare il piano: poter ritirare un evento già approvato dall'interfaccia e documentare il flusso.

**Dove:**
- `features/revisione/revisione.page.ts`: nuova scheda "Approvati" (eventi pubblici dello store locale) con "Ritira…" (dialog con motivo, usa `Revisione/Rifiuta` → tombstone); dopo il ritiro sincronizza e ricarica.
- `README.md`: sezione "Moderation", voci "Report/Review", nuovi endpoint in tabella, tolta la voce da "What's next".

**Verifica:** `ng build` ok, `dotnet build` ok, `dotnet test` 58/58. Id eventi = `crypto.randomUUID` (non indovinabili per `GetStati`). Giro a mano nel browser e prova su SQL Server reale NON fatti.

**Note/da fare:** dopo la migrazione approvare gli eventi esistenti da `/revisione`. La scheda Approvati dipende dallo store locale (serve essere sincronizzati).

## 2026-10-23 — Moderazione M5: pagina di revisione in Angular

**Perché:** Editor e Admin devono poter approvare o rifiutare le segnalazioni (e approvare in blocco gli eventi esistenti, tutti `InAttesa`) dall'interfaccia.

**Dove (Angular):**
- `core/revisione.service.ts` (nuovo): client di `GET Revisione/DaRivedere`, `POST Revisione/Approva|Rifiuta`; signal `inAttesa` per il contatore.
- `features/revisione/revisione.page.ts` (nuovo, rotta `/revisione` con guard `richiedeModifica`): schede In attesa / Rifiutati, `p-table` con selezione multipla (max 100 per richiesta), Approva, Rifiuta con dialog del motivo (obbligatorio, max 500); dopo ogni azione ricarica la lista e mostra un toast. Nei Rifiutati si può ri-approvare.
- `app.ts`: voce di menu "Revisione (n)" solo per chi può modificare; il contatore si aggiorna all'avvio, al cambio ruolo e al ritorno online. `app.routes.ts`, `core/models.ts` (`motivoRifiuto`, `EsitoRevisione`).

**Verifica:** `ng build` ok. Non provato nel browser.

**Note/da fare:** il ritiro di un evento già approvato non ha ancora un pulsante (l'endpoint c'è); il contatore non si aggiorna in tempo reale. M6: chiusura e nota nel README.

## 2026-10-23 — Moderazione M4: Angular store/segnalazione + `403` per modifiche non autorizzate

**Perché:** (a) decisione dell'utente: modificare un evento esistente senza ruolo deve dare `403` invece di essere ignorato con `200`; (b) chi segnala un evento deve vederlo "in attesa" sul proprio dispositivo e conoscerne l'esito.

**Backend:**
- `EfCoreEventiService.UpdateEventiAsync` ora restituisce `bool`: `false` se il payload contiene una modifica vera a un evento esistente senza policy `PuoModificare` (i nuovi eventi della richiesta sono inseriti comunque). Un re-invio identico a quanto salvato (`StessoContenuto`) resta innocuo, così un retry dopo risposta persa non dà errore. `EventiEndpoints.UpdateEventiAsync` risponde `403` (ProblemDetails). `IEventiService` aggiornata.
- Test: 3 test esistenti ora attendono `403`, nuovo test del re-invio identico (58/58).

**Angular:**
- `core/models.ts`: `Evento.stato`, `StatoModerazione`, `EsitoModerazione`, `EventoLocale.mio`/`motivoRifiuto`. `eventi-api.service.ts`: `getStati(ids)`.
- `eventi-store.service.ts`: `crea` marca `mio` e `stato` (InAttesa, o Approvato se l'utente può modificare); `eventi()` mostra solo gli approvati (o senza stato, dati legacy); nuovo `mieSegnalazioni`; `aggiornaStati()` dopo il pull chiama `GetStati` (blocchi da 50) per le mie non approvate, errori ignorati; `unisci` conserva `mio` e prende `stato` dal server; `rimuoviSegnalazione(id)`.
- `evento-form.page.ts`: messaggio "Sarà visibile a tutti dopo la revisione". `evento-detail.page.ts`: avviso In attesa/Rifiutata con motivo.
- Nuova pagina `features/segnalazioni/mie-segnalazioni.page.ts` (rotta `/segnalazioni`) con badge e rimozione delle rifiutate; voce di menu "Le mie" (`app.ts`, `link` ora `computed`) visibile solo se ci sono segnalazioni in sospeso.
- `README.md` e `PLAN-migrazione-backend.md` allineati alla decisione 403.

**Verifica:** `dotnet build` 0/0, `dotnet test` 58/58, `ng build` ok. Non provato nel browser.

**Note/da fare:** M5 (pagina `/revisione`) per approvare dall'interfaccia. Un evento rifiutato non genera notifiche: l'autore lo scopre alla sincronizzazione.

## 2026-10-23 — Moderazione M3: endpoint di revisione e `GetStati`

**Perché:** permettere a Editor/Admin di approvare, rifiutare o ritirare gli eventi segnalati, e a chi ha segnalato di conoscere l'esito.

**Dove:**
- `Endpoints/RevisioneEndpoints.cs` (nuovo), gruppo `/api/Eventi/Revisione` con policy `PuoModificare` (401 anonimo, 403 senza ruolo): `GET /DaRivedere?stato=InAttesa|Rifiutato` (default InAttesa, più vecchi per primi, max 200, `Approvato` → 400), `POST /Approva {ids}`, `POST /Rifiuta {ids, motivo}` (max 100 id, id non vuoti, motivo obbligatorio max 500). Risposta `{modificati}`; id sconosciuti o già nello stato richiesto sono ignorati. Registrato in `Program.cs`.
- `EfCoreEventiService` / `IEventiService`: `GetDaRivedereAsync`, `ApprovaAsync`, `RifiutaAsync`, `GetStatiAsync`. Ogni revisione imposta `RevisionatoDa` (email dal claim), `DataRevisione`, nuovo `DataOraUltimaModifica` (cursore di sync) e invalida la cache. Rifiutare un evento approvato lo ritira: `Rifiutato` + `EventoConcluso` (tombstone, i client lo eliminano). Approvare un rifiutato/ritirato azzera il motivo e ricalcola `EventoConcluso` (vero solo se `DataFineEvento` è passata).
- `EventiEndpoints.cs`: `GET /api/Eventi/GetStati?ids=` anonimo (1–50 id), rate limit policy `stati` (`Eventi:RichiesteStatiAlMinuto`, default 30, in `ServiceCollectionExtensions.cs` e `appsettings.json`). Restituisce solo `{id, stato, motivoRifiuto}` (motivo solo se rifiutato).
- `SagreEventi.Shared/Models/RevisioneModels.cs` (nuovo): `StatoEventoModel`, `ApprovaEventiRequest`, `RifiutaEventiRequest`, `RevisioneEsito`.
- `EventiApiTests.cs`: 15 test nuovi (401/403, elenco, approvazione singola/multipla con cache invalidata, validazioni, rifiuto con motivo, ritiro con tombstone, GetStati).

**Verifica:** `dotnet build` 0 errori/0 avvisi; `dotnet test` 57/57 (3 esecuzioni). Non provato su SQL Server né dal browser.

**Note/da fare:** la UI non esiste ancora (M4 segnalazione, M5 revisione): finché non c'è, gli eventi esistenti si approvano solo via API. Un evento ritirato e poi riapprovato con data già passata resta concluso (coerente con la futura scadenza automatica 7-ter).

## 2026-10-23 — Moderazione M2: insert come InAttesa/Approvato e `GetEventi` filtrato

**Perché:** gli eventi segnalati dagli anonimi non devono essere visibili finché non revisionati.

**Dove:**
- `EfCoreEventiService.ApplicaAsync`: un evento nuovo nasce `Approvato` se chi scrive ha la policy `PuoModificare`, altrimenti `InAttesa`; lo stato non viene mai dal payload e un update di un revisore non lo cambia.
- `EfCoreEventiService.GetEventiAsync`: usa `EventoMappings.VisibilePubblico` (`Approvato`, oppure `Rifiutato` + `EventoConcluso`) e `ToDtoPubblico`. Gli `InAttesa` e i `Rifiutato` non conclusi non escono mai, nemmeno se scaduti.
- **Tombstone:** un evento ritirato (Rifiutato + concluso, impostato in M3) esce solo con id e date, con nome/città/descrizione vuoti e senza motivo, così il client lo elimina ma non riceve il contenuto rifiutato. La cache resta una sola (la lettura è uguale per tutti).
- Test (42/42): anonimo/senza ruolo → InAttesa, Editor/Admin → Approvato, stato inviato dal client ignorato, update del revisore non cambia lo stato, GET senza InAttesa/Rifiutati, GET con approvati, tombstone senza contenuto, InAttesa scaduto non esce. I test esistenti che leggevano dopo un insert anonimo ora inseriscono come Editor. `ClientConRuoloAsync` mette in cache il token per ruolo (il login ha il limite 10/min per IP, con più test andava in 429).

**Verifica:** `dotnet build` 0/0, `dotnet test` 42/42 (3 run). Non provato su SQL Server né nel browser.

**Note/da fare:** da ora gli eventi esistenti nel DB (tutti `InAttesa` dopo la migrazione) spariscono dal sito finché non c'è la revisione (M3/M5); lato Angular l'evento appena segnalato non compare più nella lista dell'autore fino a M4. Prossimo: M3 (endpoint di revisione e `GetStati`), in attesa del "vai".

## 2026-10-23 — Moderazione M1: modello dati e migrazione `AddModerazione`

**Perché:** primo step di `PLAN-moderazione-eventi.md`: serve uno stato di revisione per nascondere gli eventi non approvati (il filtro è in M2, per ora il comportamento pubblico è invariato).

**Dove:**
- `Shared/Models/StatoModerazione.cs` (nuovo): enum `InAttesa=0 / Approvato / Rifiutato`, serializzato come stringa (`[JsonConverter]`). `EventoModel`: `Stato` e `MotivoRifiuto` (solo output, il server li ignora in ingresso).
- `Web.Server/Models/Entities/Evento.cs`: `Stato`, `MotivoRifiuto` (max 500), `RevisionatoDa` (max 256, email), `DataRevisione`. `AppDbContext`: lunghezze massime.
- `EventoMappings`: `ToDto` proietta `Stato`/`MotivoRifiuto`; `ToEntity`/`ApplyFrom` non li copiano mai dal client.
- Migrazione `20261023114159_AddModerazione`: 4 colonne su `Eventi`, `Stato` int NOT NULL default 0 → **tutti gli eventi esistenti diventano `InAttesa`** (decisione del piano). `has-pending-model-changes` pulito. **Non applicata**: parte da sola all'avvio (`Database:MigraAllAvvio`).
- Test `EventoMappingsTests` (3): 32/32 in totale.

**Note/da fare:** appena applicata la migrazione gli eventi esistenti restano visibili fino a M2 (poi spariscono dal pubblico finché non approvati da M3/M5). L'Angular riceve il nuovo campo `stato` e lo ignora. Prossimo: M2 (insert come InAttesa/Approvato e filtro su `GetEventi`), in attesa del "vai".

## 2026-10-23 — README aggiornato (Identity, ruoli, seed, limiti, CORS, solo API)

**Dove:** `README.md`: intro e scope (login Admin/Editor, niente registrazione pubblica), tecnologie, tabella endpoint (`/api/auth/*`, limiti del PUT, timestamp deciso dal server), quickstart con `appsettings.local.json` e seed all'avvio, tabella configurazione (`Identity:*`, `Database:MigraAllAvvio`, `Eventi:*`, `Cors:Origins`), nota CORS/proxy, "What's next" con moderazione e 7-bis/7-ter.

## 2026-10-23 — Step 7: rimozione del client Blazor (backend solo API)

**Perché:** il frontend è solo Angular; il server non deve più ospitarlo.

**Dove:**
- Eliminata la cartella `src/SagreEventi.Web.Client` (tracciata in git: recuperabile) e tolta da `SagreEventi.sln`; aggiunto `PLAN-moderazione-eventi.md` tra i Solution Items.
- `Web.Server.csproj`: rimossi `ProjectReference` al Client e il pacchetto `Microsoft.AspNetCore.Components.WebAssembly.Server`. `Program.cs`: rimossi `UseWebAssemblyDebugging`, `UseBlazorFrameworkFiles`, `UseStaticFiles`, `MapFallbackToFile`. `launchSettings.json`: tolto `inspectUri` di Blazor.
- `SagreEventi.Shared`: eliminato `Models/EventiStore.cs`; tolto `SupportedPlatform browser` dal csproj.
- README e commenti Angular: tolti i riferimenti a Blazor.

**Verifica:** `dotnet build` 0 errori/0 avvisi, `dotnet test` 29/29, `ng build` ok. Il server alla radice (`/`) ora risponde 404: l'UI è su Angular.

**Note/da fare:** il README descrive ancora l'app come "senza account né autenticazione" (non aggiornato per Identity); `.github/copilot-instructions.md` non citava Blazor. Restano da decidere: 403 vs "ignora con 200"; prossimo step (moderazione M1, 7-bis, 7-ter), in attesa del "vai".

## 2026-10-23 — Step 6-bis: correzioni da analisi bug (cursore, id duplicati, Bearer null, limiti)

**Perché:** un client poteva avvelenare il cursore di sync con `DataOraUltimaModifica` futura; id duplicati davano 500; l'insert anonimo era senza limiti.

**Dove:**
- `EfCoreEventiService.UpdateEventiAsync`: `DataOraUltimaModifica = UtcNow` deciso dal server su insert e update (il valore del client serve solo al confronto "più recente vince"); dedup per id nel batch; su `DbUpdateException` un solo retry (id inserito in concorrenza).
- `EventiEndpoints`: max `Eventi:MaxPerRichiesta` (default 20) eventi per PUT → 400; rate limit `scrittura` su `PUT /UpdateEventi` (`Eventi:RichiestePutAlMinuto`, default 10/min per IP, letto a runtime). `ServiceCollectionExtensions` registra la policy; `appsettings.json` ha la sezione `Eventi`.
- Angular `auth.interceptor.ts`: niente header `Bearer null` dopo un rinnovo fallito; `eventi-store.service.ts`: push a blocchi da 20 (`MAX_EVENTI_PER_RICHIESTA`, da tenere allineato al server).
- Test (29/29): timestamp server, id duplicati, limite 20/21, 429; i test esistenti usano tempi relativi a `UtcNow`; `ApiFactory` alza il rate limit a 1000.

**Verifica:** `dotnet test` 29/29, `tsc` e `ng build` ok. Non provato nel browser.

**Note/da fare:** il comportamento "ignora con 200" per i non autorizzati resta (decisione 403 aperta). Prossimo: step 7 (rimozione Blazor) o M1 della moderazione, in attesa del "vai".

## 2026-10-23 — Piano: moderazione degli eventi segnalati (nessuna modifica al codice)

**Perché:** gli eventi segnalati da anonimi erano subito pubblici; devono essere visibili solo dopo la revisione di un Editor/Admin.

**Dove:** nuovo `PLAN-moderazione-eventi.md` (step M1–M6: stato `InAttesa/Approvato/Rifiutato`, filtro sul `GetEventi` pubblico, endpoint `/api/Eventi/Revisione`, `GetStati` per il segnalante, store e pagina `/revisione` in Angular). Decisioni: eventi esistenti tutti `InAttesa`, rifiutati conservati, si parte dopo il 6-bis, gestione utenti resta al 7-bis (solo Admin).

**Da fare:** attendere il "vai" (prima il 6-bis, poi M1).

## 2026-10-23 — Seed al primo avvio: migrazioni, Admin ed Editor con dati fittizi

**Perché:** il seed esisteva ma senza configurazione non creava nessun utente e non applicava le migrazioni.

**Dove:**
- `appsettings.json`: `Database:MigraAllAvvio=true`, `Identity:Admin` (`admin@sagreeventi.local` / `Admin!12345`) e `Identity:Editor` (`editor@sagreeventi.local` / `Editor!12345`), `Cors:Origins` = `http://localhost:4200`. Valori **fittizi**: da sovrascrivere in `appsettings.local.json`.
- `Extensions/IdentitySeeder.cs`: `MigrateAsync` all'avvio (solo SQL Server, se il flag è attivo), poi ruoli e utenti Admin/Editor tramite helper `CreaUtenteAsync`.

**Verifica:** `dotnet test` 23/23 (build in una cartella `artifacts` alternativa perché l'API in debug bloccava i file). Non provato contro SQL Server.

**Note/da fare:** cambia le password prima di ogni deploy; in produzione valuta `MigraAllAvvio=false`. Nessun evento di esempio.

## 2026-10-23 — Fix: pagina bianca all'avvio di Angular (NG0203)

**Perché:** nell'initializer di `app.config.ts` `inject(AuthService)` veniva chiamato dopo un `await`, fuori dal contesto di iniezione: il bootstrap falliva e restava la pagina bianca.

**Dove:** `src/SagreEventi.Web.Angular/src/app/app.config.ts` (i due `inject()` ora prima dell'`await`).

**Verifica:** `ng build` ok; non provato nel browser.

## 2026-10-23 — Piano: aggiunti step 6-bis e 7-ter, salvato lo stato per riprendere (nessuna modifica al codice)

**Perché:** chiusura sessione. Nel piano `PLAN-migrazione-backend.md` c'è ora la sezione "Stato avanzamento" (cosa è fatto, prossimo step, decisioni aperte, azioni manuali dell'utente).

**Dove:** solo `PLAN-migrazione-backend.md`: **6-bis** (cursore di sync avvelenabile da `DataOraUltimaModifica` inviata dal client, id duplicati → 500, interceptor `Bearer null`, limiti all'insert anonimo); **7-ter** (scadenza automatica eventi con intervallo in `appsettings.json`, nessuna conclusione manuale, eventi conclusi non modificabili da nessuno); nota sul 403 da valutare nello step 5.

**Da fare alla ripresa:** attendere il "vai" dell'utente sul 6-bis (o sul 7). Decisioni aperte: limiti del punto 6-bis.4.

## 2026-10-23 — Step 6: Angular con login, token Bearer e permessi da ruolo

**Perché:** abilitare la modifica degli eventi nel frontend solo a chi ha fatto login con ruolo Admin/Editor.

**Dove:**
- Backend `Extensions/IdentityServices.cs`: nuovo `GET /api/auth/me` (richiede token, senza rate limit) → `{ email, ruoli[] }` letti dal DB. Test `Me_*` in `AuthTests.cs`.
- Angular `core/auth.service.ts`: login (`/api/auth/login` poi `/me`), logout, rinnovo con refresh token (condiviso tra chiamate concorrenti), sessione in `sessionStorage`, `aggiornaUtente()` all'avvio per riallineare i ruoli.
- Angular `core/auth.interceptor.ts`: Bearer solo verso `apiBaseUrl`; rinnova prima dell'invio se scaduto (un token scaduto sarebbe anonimo e il server ignorerebbe le modifiche con 200); su 401 un solo retry dopo il rinnovo.
- Angular `core/permessi.service.ts`: `autenticato` da `AuthService`, `eAdmin`, `puoModificare()` = Admin o Editor; la guard `richiedeModifica` resta.
- Angular `core/eventi-store.service.ts` + `models.ts`: flag `protetta` su modifica/conclusione; senza ruolo la sync non le invia (restano `dirty`, niente perdita silenziosa) e le invia dopo il login.
- Angular `features/login/login.page.ts`, rotta `/login`, `app.ts` (Accedi / Esci nella topbar), `app.config.ts` (`withInterceptors`, initializer).

**Verifica:** `dotnet build` 0 errori/0 avvisi, `dotnet test` 23/23; `tsc --noEmit` e `ng build` ok. Non provato nel browser contro un'API reale.

**Note/da fare:** serve `dotnet ef database update` e `Identity:Admin:*` in `appsettings.local.json`; `Cors:Origins` deve includere l'origine di Angular. I ruoli si riallineano al caricamento della pagina. Prossimo: step 7 (rimozione Blazor), in attesa di conferma.

## 2026-10-23 — Step 5: modifica protetta lato server (+ nuovo step 7-bis nel piano)

**Perché:** solo chi ha ruolo Admin/Editor può modificare eventi esistenti; l'inserimento di eventi nuovi resta anonimo.

**Dove:**
- `PLAN-migrazione-backend.md`: aggiunto lo **step 7-bis** (sezione "Amministrazione": gestione utenti con creazione/modifica/cancellazione/assegnazione ruoli, ruoli non modificabili, solo Admin loggato; backend `/api/admin/utenti` + Angular `/amministrazione`).
- `Endpoints/EventiEndpoints.cs`: `UpdateEventi` resta unico e anonimo; verifica la policy `PuoModificare` con `IAuthorizationService` e passa `consentiModifiche` al servizio.
- `IEventiService`/`EfCoreEventiService.UpdateEventiAsync(eventi, consentiModifiche, ct)`: eventi nuovi sempre inseriti; quelli già esistenti sono aggiornati (last-write-wins) solo se `consentiModifiche`.
- Test (21/21): anonimo e utente senza ruolo non modificano esistenti, anonimo inserisce i nuovi anche in una richiesta mista, Editor e Admin modificano; i test di update esistenti ora usano un Editor (helper `ClientConRuoloAsync`).

**Note:** scelta di comportamento: per chi non ha permessi gli eventi esistenti sono **ignorati con 200** (non 403), così i re-invii della sync (evento già inserito ma ancora `dirty` sul client) non bloccano l'intero batch; se preferisci 403 va cambiato. Il token non valido/scaduto è trattato come anonimo. L'Angular non invia ancora il token (step 6).
**Prossimo:** step 6 (Angular: login, interceptor, PermessiService), in attesa di conferma.

## 2026-10-23 — Step 4: ASP.NET Core Identity (solo ruoli)

**Perché:** autenticazione con bearer token e ruoli per abilitare in seguito la modifica degli eventi (la protezione degli endpoint è lo step 5).

**Dove (src/SagreEventi.Web.Server):**
- `Models/Identity/ApplicationUser.cs`, `Ruoli.cs` (ruoli `Admin`, `Editor`; policy `PuoModificare`).
- `AppDbContext` ora è `IdentityDbContext<ApplicationUser>` (stesso DB e tabella `dbo.Migrations`). Migrazione `AddIdentity` (solo 7 tabelle AspNet*, `Eventi` invariata; `has-pending-model-changes` pulito). **Non applicata a nessun DB**: serve `dotnet ef database update` prima di avviare l'API.
- `Extensions/IdentityServices.cs`: `AddIdentityApiEndpoints` + ruoli, policy `PuoModificare` (Admin/Editor), rate limiting `auth` (10 richieste/min per IP), `MapAuthEndpoints` → `/api/auth/*` (login, refresh, manage/info…). **Registrazione pubblica disattivata** (`/api/auth/register` → 404) salvo `Identity:RegistrazionePubblica=true`.
- `Extensions/IdentitySeeder.cs`: hosted service che all'avvio crea i ruoli e, se presenti `Identity:Admin:Email` e `Identity:Admin:Password`, il primo Admin (metterli in user-secrets/`appsettings.local.json`/variabili d'ambiente, mai in `appsettings.json`).
- CORS: `Cors:Origins` (array) con `WithOrigins`; senza configurazione nessuna origine cross-origin è ammessa (niente `AllowAnyOrigin`, niente credenziali).
- `Program.cs`: `UseRateLimiter`, `UseAuthentication`, `UseAuthorization` dopo `UseCors`. csproj: `Microsoft.AspNetCore.Identity.EntityFrameworkCore 10.0.13`.
- Test: `AuthTests` (login ok/ko, registrazione 404, seed Admin, manage/info con token, rate limit 429); `ApiFactory` con config Admin in memoria e creazione schema prima del seed. 17/17 ok.

**Note:** gli endpoint eventi sono ancora tutti anonimi (step 5). Il token di `MapIdentityApi` è opaco (non JWT). In dev serve `Cors:Origins` solo se l'Angular non usa il proxy. Test flaky risolto: il timer di `EventiHostedService` usava in parallelo la connessione SQLite condivisa (non thread-safe) insieme al seed; in `ApiFactory` ora è rimosso (10 run consecutive ok).
**Prossimo:** step 5 (fatto).

## 2026-10-23 — Step 3: OpenAPI nativo + schema Bearer

**Perché:** sostituire Swashbuckle con `Microsoft.AspNetCore.OpenApi` (nativo .NET 10) e predisporre lo schema Bearer per gli endpoint protetti degli step 4-5.

**Dove (src/SagreEventi.Web.Server):**
- `Extensions/OpenApiServices.cs` (nuovo, sostituisce `SwaggerServices.cs` eliminato): `AddOpenApi("v1")` con document transformer (info/contatto/licenza come prima + security scheme `Bearer`, HTTP bearer).
- `Program.cs`: in Development `app.MapOpenApi()` (documento su `/openapi/v1.json`) al posto di `UseSwagger/UseSwaggerUI`. `ServiceCollectionExtensions`: `AddOpenApiServices()`.
- csproj: `Swashbuckle.AspNetCore` → `Microsoft.AspNetCore.OpenApi 10.0.13`.
- Test: `OpenApiTests` (documento in Development espone i 2 endpoint e lo schema Bearer). 11/11 ok, build 0 errori/0 avvisi.

**Note:** l'OpenAPI nativo non include una UI: non c'è più `/swagger`, solo il JSON (importabile in Postman/Scalar/Swagger Editor). Lo schema Bearer non è ancora applicato a operazioni specifiche (requirement per-endpoint negli step 4-5). `GenerateDocumentationFile` lasciato com'è.
**Prossimo:** step 4 (fatto).

## 2026-10-23 — Step 2: Minimal API

**Perché:** passare da MVC (`Startup` + controller) a Minimal API mantenendo identico il contratto (`GET api/Eventi/GetEventi?since=`, `PUT api/Eventi/UpdateEventi`, 200 a body vuoto).

**Dove (src/SagreEventi.Web.Server):**
- Eliminati `Startup.cs`, `Controllers/EventiController.cs`, `Pages/Error.cshtml(.cs)` (Razor Pages/MVC rimossi).
- `Endpoints/EventiEndpoints.cs` (nuovo): `MapGroup("/api/Eventi")`, validazione con `EventoValidator` → `Results.ValidationProblem` (400). `since` è `DateTime?` (con `DateTime = default` il binding va in errore; assente = `default` come prima).
- `Extensions/ServiceCollectionExtensions.cs` (nuovo): `AddApplicationServices` (servizi di Startup + `AddProblemDetails`, `JsonOptions`); `Program.cs` ridotto a pipeline (`UseExceptionHandler` fuori da Development; Swagger/WebAssemblyDebugging in Development).
- `EfCoreEventiService`: ora riceve `IFusionCache` (non più cache privata per istanza); chiavi con `since`/`dataOdierna` (`.Ticks`); tag `eventi` e `RemoveByTagAsync` dopo ogni `SaveChanges` così un GET dopo un PUT non legge dati vecchi. `ApplicationExtension.GetFusionCacheDefaultOptions` ora non è più usato.
- Test: +2 (cache distingue `since`, GET dopo modifica non serve dati vecchi); `ApiFactory` toglie i provider di log (crash a fine test per il timer di `EventiHostedService` sul logger EventLog). 10/10 ok, build 0 errori/0 avvisi.

**Note:** hosting Blazor (`UseBlazorFrameworkFiles`, `UseStaticFiles`, fallback) lasciato fino allo step 7. Swashbuckle resta fino allo step 3. Piano copiato in `PLAN-migrazione-backend.md` (root). Ora la cache è condivisa: prima, essendo per istanza transient, di fatto non cachava.
**Prossimo:** step 3 (fatto).

## 2026-10-23 — Step 1: DTO ed entità separati

**Perché:** `EventoModel` (Shared) era insieme DTO ed entità EF; ora il contratto con i client resta `EventoModel`, la persistenza usa un'entità del server. Schema DB invariato.

**Dove (src/SagreEventi.Web.Server):**
- `Models/Entities/Evento.cs` (nuovo): entità; date non nullable, stringhe obbligatorie via fluent in `AppDbContext`.
- `Models/Mapping/EventoMappings.cs` (nuovo): `ToDto` (expression, traducibile in SQL), `ToEntity`, `ApplyFrom`.
- `Validation/EventoValidator.cs` (nuovo): validazione esplicita (DataAnnotations di `EventoModel` + Id obbligatorio), usata da `EventiController.UpdateEventiAsync` → 400 `ValidationProblem`.
- `AppDbContext` (`DbSet<Evento>`), `EfCoreEventiService` (mappa DTO↔entità, interfaccia `IEventiService` invariata), `Migrations/AppDbContextModelSnapshot.cs` (nome tipo e `DateTime` non nullable, a mano). `dotnet ef migrations has-pending-model-changes`: nessuna modifica.
- Test: `EventiApiTests` ora legge `Evento`; aggiunti 2 test (400 per evento non valido / senza Id). 8/8 ok.

**Note:** nuovo comportamento: PUT con Id vuoto ora risponde 400 (prima 500 in DB). Usate DataAnnotations invece di FluentValidation (serve solo nel client Blazor, che verrà rimosso). `Designer` della migrazione 2022 lasciato com'è. Il validatore verrà richiamato dall'endpoint nello step 2.
**Prossimo:** step 2 (Minimal API), in attesa di conferma.

## 2026-10-23 — Step 0: test di caratterizzazione

**Perché:** rete di sicurezza prima di migrare a Minimal API + Identity; fissa il comportamento attuale dell'API.

**Dove:** nuovo `tests/SagreEventi.Web.Server.Tests` (xUnit + `WebApplicationFactory<Program>`, SQLite in memoria al posto di SQL Server): `ApiFactory.cs`, `EventiApiTests.cs` (PUT insert, evento già concluso ignorato, update se più recente, ignorato se più vecchio; GET con `since`, GET vuoto). Aggiunto a `SagreEventi.sln`. `dotnet test`: 6/6 ok.

**Note:** `appsettings.json` NON toccato (su richiesta: i secrets verranno gestiti in seguito dall'utente, punto 3 dello step 0 saltato). Il bug noto della chiave cache fissa in `EfCoreEventiService` non è coperto dai test (la cache è per istanza del servizio): da verificare allo step 2.

**Prossimo:** step 1 (separare DTO ed entità), in attesa di conferma.

<!--
## 2026-10-22 — Modifica eventi inibita (manca login/registrazione)

**Perché:** il backend non ha autenticazione; l'inserimento resta libero, la modifica di eventi esistenti no.

**Dove (src/SagreEventi.Web.Angular/src/app):**
- `core/permessi.service.ts` (nuovo): `PermessiService.autenticato` (signal, `false`) e `puoModificare()`; guardia di rotta `richiedeModifica` (redirect a `/eventi/:id`).
- `app.routes.ts`: `canActivate: [richiedeModifica]` su `eventi/:id/modifica`.
- `features/eventi/evento-detail.page.ts`: pulsanti "Modifica" e "Segna come concluso" visibili solo se `puoModificare()`; `chiediConclusione()` esce se non permesso.
- `core/eventi-store.service.ts`: `aggiorna()` e `concludi()` sono no-op se `!puoModificare()`.

**Da fare / note:** quando ci sarà il login, impostare `PermessiService.autenticato` dalla sessione. Il backend (`EventiController.UpdateEventiAsync`, PUT unico per insert+update) NON è protetto: servirà `[Authorize]` e distinguere insert da update.

## Contesto del progetto (stabile)

- Backend .NET 10: `src/SagreEventi.Web.Server` (API `api/Eventi/{GetEventi,UpdateEventi}`), client Blazor in `SagreEventi.Web.Client`.
- Frontend Angular + PrimeNG in `src/SagreEventi.Web.Angular`, offline-first (localStorage, sync push dirty poi pull da cursore) in `core/eventi-store.service.ts`.
- Verifica compilazione Angular: `npx tsc --noEmit -p tsconfig.app.json` dalla cartella Angular. Python non è installato.
-->
