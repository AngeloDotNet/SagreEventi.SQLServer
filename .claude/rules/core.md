# Regole Core (sempre caricate)

> Versione 3.18 — ultima revisione: 2026-11-01. Angular, PrimeNG e `OperationResults` cambiano in fretta: in caso di dubbio su un'API, verifica la versione installata nel progetto, non la memoria.
> Moduli correlati: `frontend.md` (Angular/UI), `backend.md` (.NET/dati; opzionali `backend-email.md` per l'invio email e `backend-infra.md` per messaggistica, cache ed eventi, aggiunti quando servono), `feature-workflow.md` (opzionale, solo fullstack e su conferma: flusso per entità, backend → frontend), `security.md` (sicurezza), `docker.md` (deploy), `git.md` (commit). Un progetto importa solo quelli che gli servono.

## Regola inviolabile: nel dubbio, una domanda alla volta
**MUST, sempre attiva, senza che l'utente debba ricordarla o richiederla.** Se c'è un dubbio, un'ambiguità o più strade ragionevoli, Claude **non decide in autonomia e non procede per assunzione**: si ferma, pone **una sola domanda**, e **attende la risposta** prima di fare altro che ne dipenda.
- Una domanda per messaggio e per decisione, mai elenchi. Vale anche con lo strumento di domande interattivo (`AskUserQuestion`): **una sola domanda per chiamata**, mai 2-4 insieme, anche se sembrano indipendenti.
- Prevale su qualsiasi tendenza a "procedere quando si hanno abbastanza informazioni". Se le informazioni non bastano, o la scelta spetta all'utente, si chiede.
- Dettagli ed eccezioni (ovvio e reversibile senza costi): §6, punto 5.

## 0. Come leggere queste regole
- **Priorità:** il `CLAUDE.md` di progetto prevale su questi file in caso di conflitto. Se il conflitto non è chiaro, chiedi.
- **Valore delle regole:** ciò che è scritto con "sempre", "mai", "vietato", "obbligatorio" è **MUST/NEVER**: si deroga solo con approvazione esplicita dell'utente. Ciò che è scritto con "preferisci", "preferita", "valuta" è **PREFER**: è il default, modificabile se c'è un motivo che Claude dichiara.
- **Motivazioni:** quando una regola ha un "perché", rispettane lo scopo anche nei casi limite non previsti.

## 0b. Checklist di consegna
Prima di dichiarare concluso un compito, verifica (le voci non pertinenti al progetto si ignorano):
- [ ] Nessuna decisione presa per assunzione: ogni dubbio è stato posto all'utente, una domanda alla volta, con risposta attesa prima di procedere (regola inviolabile in testa a questo file).
- [ ] Piano scritto in `PIANO.md` prima di toccare qualsiasi file, per ogni modifica anche piccola, e aggiornato (caselle di stato) a ogni passo (§6, punto 15).
- [ ] `README.md` e `CHANGELOG.md` creati o aggiornati per questo passo (§5b).
- [ ] Build senza warning e test passati (riporta gli errori così come sono), verificati prima di spuntare il passo in `PIANO.md` (§6, punto 15).
- [ ] Commenti XML in inglese su tutti i tipi e i membri pubblici (§5b).
- [ ] Pacchetti NuGet privi di vulnerabilità note: `dotnet list package --vulnerable --include-transitive` (§3).
- [ ] Test di sicurezza con input malevoli per ogni modifica che tocca input, autenticazione o dati (`security.md`).
- [ ] Lint e formattazione puliti.
- [ ] Nessun `any`, nessuna stringa hardcoded, nessun colore hardcoded (frontend).
- [ ] Nuove chiavi di traduzione fornite (IT/EN).
- [ ] Endpoint protetti (se la sicurezza è prevista dal progetto, vedi `security.md`), input validati lato server, controlli di proprietà (anti-IDOR).
- [ ] Se la funzionalità tocca autenticazione, autorizzazione, upload, URL esterni o dati personali: security review eseguita (`security.md`).
- [ ] Migrazione EF inclusa, se il modello è cambiato.
- [ ] Nessuna nuova dipendenza non dichiarata e tutte gratuite con licenza permissiva.
- [ ] Test scritti per la nuova funzionalità (unit e integration test dove hanno senso, vedi §4).
- [ ] Integration test nel progetto `IntegrationTests` su database reale di prova, dove hanno senso (`backend.md` §4.5).
- [ ] Test di architettura verdi (solo Clean Architecture, `backend.md` §2b).
- [ ] Per ogni risorsa di un utente, test che un altro utente o tenant non la raggiunge (`backend.md` §4.6).
- [ ] Copertura sul codice nuovo o modificato ≥ 80% (§4).
- [ ] Nessun valore reale (chiavi JWT, password SMTP/Redis, ecc.) in `appsettings.json`: solo segnaposto; valori reali da variabili d'ambiente o `secrets`, elencati in `.env.example`.
- [ ] Se toccati Dockerfile o compose: `docker compose config` valido, immagine buildata, nessun segreto nei file, `.env.example` aggiornato.

---

## 1. Contratto Frontend ↔ Backend (condiviso)
Queste regole valgono per entrambi i lati e non vanno reinterpretate.
- **Chiavi, mai testo:** il backend restituisce SEMPRE chiavi di traduzione (es. `ERROR_PRODUCT_NOT_FOUND`), mai testo localizzato, sia per gli errori di validazione sia per quelli di business. I parametri dinamici viaggiano in un campo separato. Il frontend traduce.
- **Formato errori:** sempre `ProblemDetails` (RFC 9457), con errori di validazione per campo. Non esistono formati di errore paralleli.
- **Codici di errore:** 400 (richiesta o validazione, errori per campo), 401, 403, 404, 409 (conflitto o concorrenza), 412 (precondizione `If-Match` non soddisfatta), 422 (regola di business violata); tutti in `ProblemDetails` con chiave di traduzione. La mappatura lato server è in `backend.md` §4.1; il frontend gestisce ciascun codice (vedi `frontend.md`).
- **Date:** sempre UTC (ISO 8601) in transito e in storage. La conversione al fuso dell'utente avviene solo in visualizzazione.
- **JSON:** `System.Text.Json` con `camelCase`; enum come stringhe.
- **Paginazione:** query `pageNumber` (base 1), `pageSize`, `sortBy`, `sortDirection`; risposta `{ items, totalCount, pageNumber, pageSize }`.
- **Contratto API:** lo schema OpenAPI è la fonte di verità; i client TypeScript si generano da esso.

---

## 2. Stack di Riferimento
- **Frontend:** Angular + TypeScript strict + PrimeNG (dettagli in `frontend.md`). Angular è il default, ma la tecnologia (Angular o Blazor) e l'eventuale sviluppo mobile (e con quale tecnologia) si chiedono a ogni progetto, vedi `avvio-progetto.md` §1; per Blazor e per il mobile non esistono ancora regole.
- **Backend:** .NET 10 / C# 14 + EF Core 10 (default; Dapper è l'alternativa da valutare ogni volta, non scontata) su SQL Server o PostgreSQL, da chiedere ogni volta (dettagli in `backend.md`).
- **Test:** xUnit (backend; integration test in un progetto dedicato con database reale di prova, vedi §4 e `backend.md` §4.5), Vitest + Playwright (frontend); dettagli nel §4. Non usare Jest né Karma/Jasmine nei nuovi progetti.
- **Infrastruttura di riferimento:** database a scelta per progetto (SQL Server o PostgreSQL), già presente e gestito sul server (mai nel compose, vedi `docker.md`), Redis (solo cache e solo se un L2 è stato approvato, non presunto) e RabbitMQ (solo messaggistica), questi ultimi in container.

---

## 3. Dipendenze e Licenze
- **Solo software gratuito e open source con licenza permissiva** (MIT, Apache-2.0, BSD). Mai pacchetti a pagamento, con licenza commerciale o con funzioni essenziali nel tier a pagamento. Licenze copyleft (GPL, LGPL, AGPL) solo previa approvazione esplicita.
- **Eccezione per i servizi di infrastruttura esterni e non modificati** (PostgreSQL, Redis, RabbitMQ, ecc.): non sono librerie collegate al codice, quindi la loro licenza non si estende all'applicazione. SQL Server è ammesso solo nelle edizioni Express/Developer o con licenza già in possesso del cliente. Quando proponi il motore, segnala questo vincolo di licenza di SQL Server.
- **Eccezione axe-core (strumenti di test di accessibilità):** `axe-core` e `@axe-core/playwright` sono ammessi anche se la loro licenza è copyleft debole (MPL-2.0, per quanto noto), perché si usano solo in sviluppo e in CI, non entrano nella build distribuita e non vengono modificati. La licenza attuale si verifica al primo uso sul repository ufficiale, senza darla per scontata; l'eccezione non si estende ad altre librerie copyleft.
- **PrimeNG solo versione gratuita (open source):** mai componenti, template o servizi PrimeNG a pagamento (PrimeBlocks, Premium Templates, licenze Pro).
- **Niente servizi cloud a pagamento** (Azure, AWS, Google Cloud o simili) per identità, segreti, storage, code, database o monitoraggio: tutto è self-hosted in container.
- Se una soluzione richiede una funzione a pagamento, Claude la segnala e propone un'alternativa gratuita.
- **Audit:** `npm audit` e `dotnet list package --vulnerable --include-transitive` (transitive incluse) eseguiti a ogni passo del piano che aggiunge o aggiorna pacchetti e in CI a ogni PR, con `NuGetAudit` attivo nel build; aggiornamenti automatici (Dependabot/Renovate). Un pacchetto vulnerabile si aggiorna, oppure si segnala all'utente con il motivo se non esiste una correzione: mai ignorato. Versioni fisse tramite lock file.

---

## 4. Test e Qualità
- **Backend:** xUnit con due livelli: **unit test** (handler, validatori, servizi e logica di business isolati, con dipendenze sostituite, senza database né rete) e **integration test** (con `WebApplicationFactory`, per endpoint, pipeline e accesso ai dati). Ogni nuova funzionalità prevede entrambi i livelli dove hanno senso; se uno dei due non si applica, lo dichiari. Gli integration test stanno in un **progetto dedicato** (`*.IntegrationTests`, xUnit + `WebApplicationFactory`) che usa un **database reale di prova** sullo stesso motore del progetto, con le regole di `backend.md` §4.5. Se un test richiede un database diverso (es. SQLite), **chiedi prima di procedere** e non presumere: SQLite non è mai una scelta di default e va valutata caso per caso (può comportarsi diversamente dal motore reale). Mai EF Core InMemory.
- **Frontend:** unit test dei servizi (`HttpTestingController`) e dei componenti con logica; Playwright per i flussi E2E principali.
- **Regola:** ogni nuova feature arriva con i suoi test.
- **Analisi statica:** analyzers Roslyn, `.editorconfig`, ESLint, Prettier. Build senza warning.
- **Copertura:** minimo 80% sulla logica di business (handler, validatori, servizi); la copertura non sostituisce test sensati. Si misura nel backend con `coverlet.collector` (MIT) e il report con `ReportGenerator` (Apache-2.0), nel frontend con la copertura di Vitest (provider v8); licenze e versioni si verificano al primo uso (§3) e gli strumenti si dichiarano come dipendenze. Per ogni bug corretto, un test che lo riproduce.
- **Test di contratto:** lo schema OpenAPI è versionato; una modifica incompatibile fa fallire la CI.
- **Accessibilità automatica:** `@axe-core/playwright` sulle pagine principali, con zero violazioni gravi.
- **Dati di test:** builder o fixture dedicati, indipendenti tra loro; i test non dipendono dall'ordine di esecuzione.
- **Progetti esistenti senza test:** Claude non retrofitta test su tutto il codice. Il codice che tocca o aggiunge ha test (la soglia dell'80% vale sul codice nuovo o modificato, non sull'intero progetto); prima di un refactoring di codice non coperto scrive test di caratterizzazione che fissano il comportamento attuale, in un commit `test` separato. Le lacune più ampie le segnala, senza colmarle di iniziativa.
- **Test rossi non correlati:** se build o test falliscono per cause estranee al lavoro in corso (test già rotti, ambiente), Claude non li corregge né li disabilita e non li nasconde: verifica sul codice non modificato (`git stash` solo se l'utente lo consente, oppure leggendo l'errore), li riporta nella consegna con l'errore così com'è e committa solo ciò che ha verificato. Mai `skip`, `Ignore` o soglie abbassate per far passare la suite.
- **Test instabili (flaky):** un test che passa e fallisce a parità di codice si segnala e si corregge alla causa (attese, orologio, ordine, dati condivisi); mai risolto con retry o sleep arbitrari.

---

## 5. Osservabilità e Operatività
- **Logging strutturato: si concorda ogni volta, senza dare per scontato né Serilog né OpenTelemetry.** Claude chiede prima *se e con quale soluzione* fare il logging strutturato; il codice scrive sempre tramite `ILogger`, e ciò che si concorda è il provider/implementazione dietro di esso: l'opzione da proporre per prima è **Serilog** (pacchetti NuGet, che si integra nativamente con `ILogger`), ma sono possibili anche i provider standard di .NET o **OpenTelemetry** (anch'esso accoppiabile a `ILogger`). Le soluzioni non si escludono a vicenda e possono essere combinate (es. Serilog con un sink OTLP). Se si sceglie Serilog, la configurazione si concorda comunque ogni volta, senza presumerla dal progetto precedente: Serilog ha molti output (sink: console, file, database, OTLP, ecc.) e formati (template testuale, JSON compatto, ecc.). Claude chiede almeno: quali sink, quale formato/`outputTemplate`, livelli minimi per namespace, rotazione e retention dei file se c'è un sink su file, eventuale arricchimento (`traceId`, nome applicazione, ambiente). La scelta va nel `CLAUDE.md`; la configurazione sta in `appsettings.json` (sezione `Serilog`) dove possibile. Verifica licenza gratuita e permissiva di ogni sink prima di proporlo. In un container i log vanno su stdout (vedi `docker.md`); un sink su file richiede quindi una conferma esplicita. Nessun dato personale o segreto nei log. Il `traceId` è propagato dal frontend al backend.
- **Shutdown:** arresto graduale (graceful shutdown) con `CancellationToken` rispettato da `BackgroundService` e hosted service; i job in corso terminano o vengono ripresi.
- **Più container:** l'app deve poter girare in più repliche senza stato locale (sessione, file, cache, scheduler); vedi `backend.md` §5b.
- **OpenTelemetry (da concordare ogni volta, non presunto):** se adottato, tracce, metriche e log, esportati in OTLP verso un Collector (`OTEL_EXPORTER_OTLP_ENDPOINT`, mai un indirizzo fisso nel codice).
- **Stack di osservabilità self-hosted (da proporre ai progetti con backend, da confermare ogni volta; presuppone OpenTelemetry):** OpenTelemetry Collector → Prometheus (metriche) e Jaeger (tracce), con Grafana come UI, tutti container nel file `docker-compose.observability.yml` (caricato in aggiunta al compose base) e configurazioni in `observability/` (`otel-collector.yaml`, `prometheus.yml`, provisioning Grafana).
  - **Log:** salvo la scelta concordata per il logging, su stdout con rotazione di Docker (`docker.md`); nessun sistema centralizzato di log di default. Loki si aggiunge solo su richiesta.
  - **Licenze:** Collector, Prometheus e Jaeger sono Apache-2.0; Grafana è AGPLv3 e rientra nell'eccezione dei servizi di infrastruttura esterni non modificati (§3). Licenze verificate il 2026-10-25 sui repository ufficiali (Prometheus, OpenTelemetry Collector, Jaeger: Apache-2.0; Grafana: AGPL-3.0-only). Per Grafana usa l'immagine OSS (`grafana/grafana-oss`), mai l'edizione Enterprise. Per ogni altra immagine non elencata, verifica la licenza al primo utilizzo. Mai SigNoz (funzioni essenziali nel tier a pagamento).
  - **Regole:** immagini con tag fissi, volumi nominati per Prometheus e Grafana, porte non esposte all'esterno tranne la UI di Grafana dietro il reverse proxy dell'utente, password di Grafana tramite `secrets`. Nessun dato personale in tracce, metriche e log.
  - Se il progetto non ne ha bisogno (app piccola, un solo container), lo dichiara in `CLAUDE.md`; i log seguono la scelta concordata per il logging (vedi il primo punto di questa sezione).
- **Docker:** vedi `docker.md`. Server, host e orchestrazione sono gestiti dall'utente e fuori dallo scopo di Claude.
- **CI/CD:** build, test, lint, scansione vulnerabilità e formattazione a ogni PR. Supply chain: SAST (CodeQL), secret scanning (gitleaks), scansione delle immagini Docker (Trivy) e SBOM generato a ogni release. Claude può scrivere e committare i file di pipeline (workflow YAML, configurazione Dependabot/Renovate); l'esecuzione, il push e la gestione dei segreti della CI restano all'utente.
- **Git:** vedi `git.md`.

---

## 5a. Docker e Docker Compose (ambito di deploy)
Il deploy avviene sempre con `Dockerfile` e `docker-compose`; le regole complete (Dockerfile multi-stage, compose per ambiente, reti, segreti, migrazioni, backup) sono nel modulo **`docker.md`**. L'host e la sua configurazione (rete, proxy, firewall, backup del server) sono gestiti dall'utente: Claude non li assume e non li configura, ma produce artefatti Docker che funzionino su qualsiasi host.

---

## 5b. Documentazione
- **README.md** di progetto, creato e aggiornato step by step come passi del piano (vedi §6, punto 15). Come modello di struttura si prende il repository https://github.com/AngeloDotNet/SagreEventi.SQLServer, adattando le sezioni al progetto e omettendo quelle non pertinenti: titolo e tagline con badge (licenza, versioni di .NET/Angular/PrimeNG), nota introduttiva sul tipo di progetto, cosa si può fare (funzionalità), stack tecnologico con le motivazioni, avvisi importanti (es. versioni bloccate e perché), flussi principali o regole di dominio, quickstart in locale (prerequisiti, avvio API/client, test), Docker (servizi, variabili `.env`, avvisi), tabella della configurazione, struttura del progetto, scope e prossimi passi, licenza, contributi. Variabili di configurazione sempre senza valori segreti. Se il repository riporta avvisi come "non ancora testato", il README li conserva finché restano veri.
- **Lingua dei documenti:** la lingua di README.md e CHANGELOG.md si **chiede a ogni progetto** (italiano, inglese o altro), senza presumerla, e si registra nel `CLAUDE.md` (campo "Lingua della documentazione"). Nomi di file, identificatori ed endpoint restano nella forma originale.
- **ADR (Architecture Decision Records):** per ogni scelta architetturale rilevante un breve file in `docs/adr/NNNN-titolo.md` (contesto, decisione, conseguenze). Claude propone di scriverne uno quando la decisione devia dalle regole di questi file.
- **Commenti XML** (`<summary>`) **in inglese** su tutti i tipi e i membri pubblici (classi, record, interfacce, metodi) e sugli endpoint (alimentano OpenAPI). Sono esclusi i membri ovvi: `override`, implementazioni di interfacce già documentate, proprietà dei DTO. Commenti nel codice solo per il "perché", non per il "cosa".
- **Changelog:** `CHANGELOG.md` nella root, creato e aggiornato da Claude **a ogni step del piano** (non solo al rilascio), nel formato del repository di riferimento https://github.com/AngeloDotNet/SagreEventi.SQLServer (dove il file si chiama `CHANGES.md`): una breve frase iniziale sullo scopo del file; **più recente in alto**; una voce per intervento con titolo `## AAAA-MM-GG — titolo breve` (nessun numero di versione, nessun riferimento a issue/PR nel titolo); dentro la voce etichette in grassetto: **Perché:** (motivo), **Cosa:** / **Dove:** (cosa è cambiato e in quali file), **Verifica:** (esito di build e test) e, se serve, **Note:** (limiti, seguiti). Regola del file: una voce per intervento, con cosa, dove e perché. Le voci obsolete si conservano in fondo, racchiuse in un commento HTML. Al rilascio si aggiunge soltanto una voce `## AAAA-MM-GG — Rilascio X.Y.Z` che riassume i punti salienti (vedi `git.md`). Lingua come da punto precedente.

---

## 5c. Git e Commit
Claude fa solo commit locali; `push`, PR, tag, rilasci ed esecuzione delle pipeline sono a carico dell'utente (regola 11 del §6). Le regole complete (ambito, branch, messaggi Conventional Commits, granularità, repository e hook, PR, rilascio, esempi) sono nel modulo **`git.md`**.

---

## 6. Regole di Interazione con l'Utente (Workflow)
1. **No codice legacy:** niente `NgModule`, `Startup.cs`, `*ngIf/*ngFor`, `APP_INITIALIZER`, interceptor a classe.
2. **Niente terze parti per mapping/dispatching:** non proporre MediatR né AutoMapper. L'handler/servizio ha la forma scelta dal progetto (`backend.md` §2a) e il mapping avviene tramite estensioni. La libreria di gestione errori è `OperationResults` di Marco Minerva, scelta fissa (la variante AppEngine è sospesa, vedi `backend.md` §1).
3. **Modifiche mirate:** per file esistenti mostra solo la funzione o le righe modificate, indicando il path del file e circa 3 righe di contesto. I file nuovi vanno mostrati per intero.
4. **Chiarimento architetturale:** l'architettura (Vertical Slice o Clean) si decide una volta per progetto e sta nel `CLAUDE.md` di progetto. Chiedi solo se non è specificata e il progetto è nuovo; nei moduli successivi segui la scelta già fatta.
5. **Nel dubbio, ferma e chiedi** (regola inviolabile in testa a questo file): per qualsiasi aspetto dello sviluppo (requisiti, dati, architettura, librerie, sicurezza, interfaccia, test, git, documentazione), se c'è un dubbio, un'ambiguità o più strade ragionevoli, Claude **non decide in autonomia e non procede per assunzione**. Si ferma e pone all'utente **domande precise, sempre una alla volta in tutto il workflow** (avvio, requisiti, piano, git, sicurezza, ogni altro punto): una sola domanda per messaggio e per decisione, e **attende la risposta prima di porre la successiva o di procedere**; mai elenchi di domande insieme, nemmeno quando sembrano indipendenti (se ne servono molte, le pone in sequenza, la più bloccante per prima), con il contesto minimo per rispondere e, quando utile, le opzioni con pro e contro e una raccomandazione motivata. Non scrive codice che dipende dalla risposta finché non l'ha ricevuta. Può invece proseguire con le parti non influenzate dal dubbio, dichiarando cosa ha lasciato in sospeso. Le risposte che valgono oltre il caso singolo vanno nel `CLAUDE.md` di progetto (come già per le scelte "chiesto, non presunto"). Non serve chiedere ciò che le regole o il `CLAUDE.md` già stabiliscono, né ciò che è ovvio e reversibile senza costi (es. il nome di una variabile locale).
6. **Definition of Done:** codice + test + nuove chiavi di traduzione (IT/EN) + eventuale migrazione EF. Per una nuova entità o funzionalità che attraversa più strati l'ordine di lavoro è quello di `feature-workflow.md` (solo se incluso: modulo opzionale dei progetti fullstack).
7. **Verifica:** esegui build e test prima di dichiarare concluso un compito. Riporta gli errori così come sono, senza minimizzarli.
8. **Dipendenze:** non aggiungere pacchetti senza dichiarare nome, versione e motivo. Preferisci quelli già presenti.
9. **Lingua:** codice, identificatori e commenti in inglese; spiegazioni e risposte in italiano; messaggi di commit in inglese.
10. **Regole di progetto:** le specificità (nome soluzione, database, comandi di build) stanno nel `CLAUDE.md` del singolo progetto. Questi file restano generali.
11. **Azioni git e distruttive:** Claude fa solo commit locali (vedi `git.md`). Mai `push`, PR, tag, rilasci o esecuzione di pipeline: sono a carico dell'utente. Mai `reset --hard`, cancellazione di branch o di dati senza conferma.
12. **Refactoring ampi:** se la richiesta implica toccare molti file o cambiare un'architettura esistente, descrivi il piano e chiedi conferma prima di procedere.
13. **API delle librerie:** non fidarti della memoria per API che cambiano spesso (Angular, PrimeNG, `OperationResults`, FusionCache): controlla la versione installata e la sua documentazione.
14. **Segnalazione di conflitti:** se una richiesta contraddice queste regole (es. una dipendenza a pagamento, un `any`), dillo e proponi l'alternativa conforme prima di eseguire.
15. **Piano a inizio attività, sempre:** prima di qualsiasi sviluppo (funzionalità, fix, refactoring, migrazione, modifica di configurazione) e prima di scrivere codice, Claude redige un piano e lo salva come **file `.md` dedicato**, `PIANO.md`, nella **root del progetto/soluzione** (non solo nella chat). Vale anche per l'avvio di un progetto, prima di importare i moduli delle regole (vedi `avvio-progetto.md`). Il piano contiene: obiettivo, assunzioni, passi ordinati con casella di stato (`[ ]`/`[~]`/`[x]`), file coinvolti, test previsti e decisioni aperte. **Tra i passi ci sono sempre** la creazione (se mancano) e l'aggiornamento di `README.md` e `CHANGELOG.md` (§5b), da fare a ogni passo che cambia il comportamento, la configurazione o la struttura del progetto, non tutti insieme alla fine. Lo aggiorna a ogni passo completato, ma **solo dopo aver verificato build senza errori né warning e test passati**: se falliscono, risolve prima i problemi. Se la causa è estranea al lavoro in corso, vale la regola dei test rossi non correlati (§4): li riporta senza correggerli. Se esiste già un `PIANO.md` con passi non completati, chiede se riprenderlo o sostituirlo; non lo sovrascrive di sua iniziativa.
    **Piano di sviluppo già scritto (backend, frontend o fullstack):** se l'utente fornisce un piano (file o testo, scritto prima o altrove), Claude non lo ignora né lo riscrive da zero: lo **verifica** rispetto a queste regole e al `CLAUDE.md` e riporta l'esito prima di eseguire. (a) **Conflitti** (es. MediatR o AutoMapper, dipendenza a pagamento, scelta diversa da `CLAUDE.md`, commit su `main`, ordine dei passi in contrasto con `feature-workflow.md`): per ciascuno si ferma e chiede conferma, **una domanda per volta**, e non applica la parte in conflitto finché non risponde (§6.5, §6.14); la risposta che vale oltre il caso va nel `CLAUDE.md`. (b) **Mancanze** rispetto al formato del punto 15 (obiettivo, assunzioni, caselle di stato, file coinvolti, test previsti, decisioni aperte) e ai passi sempre dovuti (aggiornamento di `README.md` e `CHANGELOG.md`, migrazione, chiavi di traduzione IT/EN, security review dove serve): le propone **una per volta**, con una domanda singola, e **solo dopo la risposta dell'utente** le aggiunge al piano (o le scarta), prima di passare alla successiva e prima di procedere con l'esecuzione; le voci aggiunte sono distinte in modo visibile dai punti originali (es. etichetta "aggiunto da Claude") ed elencate nel riepilogo, senza modificare né riordinare i punti dell'utente. Nessuna voce entra nel piano senza una risposta. Il risultato è salvato come `PIANO.md` nella root e si esegue con la regola dei passi con via libera qui sotto; la conversione vale anche se il piano originale è in un altro formato o file, che resta com'è.
    **Nessuna esclusione, mai:** il piano si scrive per **ogni** modifica, grande o piccola, anche per una sola riga, una correzione di refactoring, di configurazione o di documentazione, locale e ovvia che sembri. Per le modifiche piccole è di poche righe, ma il file `PIANO.md` esiste prima di toccare qualsiasi file del progetto. Claude non propone di saltarlo e non lo salta nemmeno se l'utente lo concede per un singolo caso: se l'utente lo chiede, ricorda la regola e scrive comunque il piano minimo. Una richiesta diretta ("modifica questo") non sostituisce il piano. Il piano è un file del progetto: lo committa solo se l'utente lo chiede.
    **Esecuzione a passi con via libera:** scritto il piano, Claude lo presenta e procede un solo punto alla volta, partendo dal primo senza attendere un ok iniziale (salvo decisioni aperte da risolvere prima). A fine di ogni punto spunta la casella, riassume cosa ha fatto (esito di build e test inclusi) e **si ferma in attesa dell'ok esplicito dell'utente** prima del punto successivo. Non concatena più punti, nemmeno se sembrano banali; se l'utente chiede modifiche, le applica e attende di nuovo l'ok.
16. **Inizio sessione, sempre:** all'inizio di ogni sessione (nuova o ripresa) Claude rilegge `PIANO.md`, `CLAUDE.md` e le regole in `.claude/rules/`, poi dà un riepilogo di 3-4 righe (passo corrente, decisioni aperte) prima di agire. Se ha un dubbio non decide: pone una domanda singola e attende la risposta (punto 5).
17. **Qualità del codice:** il codice è leggibile e manutenibile e privilegia la semplicità. Niente astrazioni, interfacce o livelli aggiuntivi senza un motivo dichiarato (overengineering): nel dubbio si sceglie la soluzione più semplice che soddisfa il requisito. Claude segue sempre le convenzioni del linguaggio, il naming, la formattazione e lo stile del progetto.
18. **Best practice su conferma:** una best practice che introduce una scelta nuova (pattern, libreria, struttura non presente nel progetto) Claude la propone con il motivo e attende il via dell'utente, una per volta, prima di usarla. Quelle già previste da queste regole si applicano senza chiedere.
19. **Fine attività, promemoria `/compact`:** al termine di ogni attività (piano completato, o blocco di passi concluso prima di passare a un lavoro non collegato) Claude lo segnala con **una sola riga** (es. "Attività conclusa: è un buon momento per `/compact`"). `/compact` è un comando interno che Claude non può eseguire: non lo tenta e non lo simula. Il promemoria non è una domanda e non interrompe il workflow.
