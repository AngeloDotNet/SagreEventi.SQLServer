# Regole di flusso per entità (backend → frontend)

> Richiede `core.md` e `backend.md` e `frontend.md` (progetti fullstack); per i commit `git.md`. **Modulo opzionale**: solo per progetti fullstack, e solo se l'utente conferma di volerlo usare. Vale per Vertical Slice e per Clean Architecture. Descrive **in che ordine** si sviluppa una nuova entità (o funzionalità CRUD) e cosa va verificato a ogni fase; il *come* sta nei moduli richiamati.

## 0. Quando si usa
- Per ogni nuova entità o funzionalità che attraversa più strati (dati, API, interfaccia). Per un fix o una modifica locale basta il piano normale (`core.md` §6.15).
- **Ambito: solo progetti fullstack** (sviluppo di nuove entità, o migrazione fullstack da Blazor ad Angular, vedi `avvio-progetto.md` §3d). Nei progetti **solo API** o **solo frontend** il modulo non si copia e non si prende in considerazione. Anche nei fullstack **si usa solo se l'utente lo conferma**: Claude lo chiede (domanda 8 di `avvio-progetto.md` §1), non lo presume.
- Se il frontend del progetto non è Angular (nessun modulo di regole, vedi `avvio-progetto.md` §1), la fase 3 non si esegue con queste regole: Claude si ferma e chiede come procedere.

## 1. Prima di iniziare (fase 0)
1. **Branch:** conferma tipo, nome e branch di partenza con l'utente (`git.md`).
2. **Requisiti:** se c'è un dubbio, Claude si ferma e fa domande precise, senza decidere in autonomia (`core.md` §6.5). Chiarisci almeno: campi e vincoli dell'entità, relazioni, regole di business, chi può leggere/scrivere (autorizzazione), se serve ricerca/paginazione/ordinamento, e le scelte del `CLAUDE.md` che la toccano (soft delete, multi-tenancy, audit).
3. **Entità di riferimento:** il `CLAUDE.md` dichiara un'entità già completata da usare come **spunto di configurazione**, non come modello da clonare. Le entità successive hanno proprietà, relazioni e regole proprie: Claude non copia l'entità né i suoi campi, ma ne **riprende le convenzioni**, per esempio:
   - interfacce e classi base del dominio (gestione dell'id, audit `CreatedAt`/`UpdatedAt`/utente, soft delete, tenant, concorrenza ottimistica);
   - configurazione EF (tipo di chiave, convenzioni di naming, indici, colonne di audit, filtri globali);
   - forma di DTO, validatori, servizio ed endpoint (nomi, gruppi, paginazione, risposte e chiavi di errore);
   - struttura di pagina, form e tabella del frontend, e stile dei test.
   Prima di scrivere codice Claude elenca all'utente quali convenzioni riprende dall'entità di riferimento e quali non si applicano alla nuova entità (es. niente soft delete); le deviazioni si segnalano e si motivano. Se non esiste ancora un'entità di riferimento, la prima entità del progetto si sviluppa con particolare cura, l'utente la approva e **diventa** l'entità di riferimento (Claude propone di registrarla nel `CLAUDE.md`).
4. **Piano:** `PIANO.md` con un punto per fase (e, dentro le fasi grandi, un punto per commit), eseguito un punto alla volta con ok esplicito (`core.md` §6.15). Se l'utente ha già un piano di sviluppo, Claude lo verifica contro queste fasi: chiede conferma per i conflitti e per ogni fase o passo mancante (es. client rigenerato, test di isolamento, chiavi di traduzione), una domanda per volta e aggiungendo al piano solo dopo la risposta, come in `core.md` §6.15.

## 2. Fase 1 — Backend completo
Ordine interno, ciascun passo che builda e passa i test:
1. **Modello e dati:** entità, configurazione EF (`IEntityTypeConfiguration<T>`), migrazione, indici e vincoli; denaro in `decimal` con precisione esplicita. Dove vanno i file: Vertical Slice → cartella della feature; Clean → `Domain` (entità) e `Infrastructure` (configurazione e migrazione), come da `backend-architecture.md` §2b. Le interfacce nuove stanno in `Interfaces/` alla radice del progetto che le contiene (`backend.md` §2). Il modello segue le scelte del `CLAUDE.md` (anemico o ricco, repository, Specification: `backend-architecture.md` §2b e §2c); se una scelta manca, Claude chiede e non la presume.
2. **Contratti:** `record` DTO di richiesta e risposta (mai entità esposte), validatori `FluentValidation` con **chiavi** di traduzione, mapping manuale con metodi di estensione.
3. **Servizio/handler:** logica di business che restituisce il tipo di risultato della libreria scelta; errori di business come chiavi (`ERROR_<ENTITY>_NOT_FOUND`) con parametri nel campo separato, e il risultato segue la tabella risultato → HTTP di `backend-app.md` §4.1. Per ogni risorsa di un utente il servizio usa `ICurrentUser` e filtra per proprietario o tenant (`backend-app.md` §4.6). Clean → in `Application`. Il service implementa la sua interfaccia (in `Interfaces/`) e si registra in DI con entrambi i tipi, con Scrutor se i service con lo stesso lifetime sono più di uno (`backend.md` §2, "Service e interfacce" e "Registrazione in blocco con Scrutor").
4. **Endpoint:** Minimal API raggruppati con `MapGroup`, commenti XML, autorizzazione esplicita, paginazione/ordinamento dove serve. Clean → in `Api`.
5. **Test:** unit test su validatori e logica; integration test sull'endpoint, nel progetto `IntegrationTests` (`backend-app.md` §4.5); test di isolamento tra utenti/tenant, obbligatorio per ogni risorsa di un utente o tenant (`core.md` §0b); in Clean, test di architettura verdi; un test per ogni bug (`core.md` §4).
6. **Seed delle chiavi di errore** del backend (IT/EN) con la fase, in script idempotente (`backend-app.md` §4.4).

**Uscita dalla fase:** build senza warning, test verdi, migrazione inclusa, endpoint raggiungibili e documentati in OpenAPI. Se l'entità tocca autorizzazione o dati personali, security review eseguita (`security.md`, "Regola operativa") e risultato riportato nella consegna.

## 3. Fase 2 — Contratto OpenAPI e client
1. Avvia l'API ed esporta/verifica lo schema OpenAPI aggiornato; lo schema versionato è la fonte di verità (`core.md` §1).
2. Controlla la differenza rispetto allo schema precedente: una modifica incompatibile fa fallire il test di contratto e va discussa con l'utente prima di proseguire.
3. **Rigenera il client TypeScript** con il comando registrato nel `CLAUDE.md` (campo "Generazione client API"). Il client sta nella cartella dedicata di `frontend.md` §2. Il codice generato non si modifica a mano e non si riscrive: se è sbagliato si corregge lo schema o la configurazione del generatore.
4. Verifica che il frontend compili con il client rigenerato.

**Uscita dalla fase:** schema e client allineati, nessun diff manuale nel codice generato.

## 4. Fase 3 — Frontend
1. **Servizio dati** sopra il client generato (nessun `HttpClient` scritto a mano per endpoint già coperti), con `Signals` per lo stato (`frontend.md`).
2. **Componenti e pagine** Standalone con PrimeNG: elenco (tabella con ricerca, ordinamento, paginazione con la conversione di `frontend.md` §8), dettaglio/modifica con form tipizzato e validazione allineata al backend, conferme per le azioni distruttive, stati di caricamento, vuoto ed errore.
3. **Errori del backend:** le chiavi ricevute si traducono con i parametri; mai testo hardcoded né chiave grezza mostrata all'utente. Ogni codice HTTP ha il trattamento della tabella di `frontend.md` §2 (400, 404, 409/412, 422, 401/403, 500).
4. **Qualità UI:** responsive (360/768/1280 px), temi, accessibilità (focus, etichette, contrasto), permessi riflessi nell'interfaccia (la sicurezza vera resta nel backend).
5. **Test:** unit test dei servizi (`HttpTestingController`) e dei componenti con logica; Playwright per il flusso principale (crea, leggi, modifica, elimina); axe sulle pagine nuove.
6. **Chiavi di traduzione dell'interfaccia** (IT/EN) con la superficie che le usa.

**Uscita dalla fase:** il flusso funziona end-to-end in almeno due lingue e due temi; lint, build e test verdi.

## 5. Fase 4 — Traduzioni e documentazione
1. **Chiavi complete:** nessuna chiave mancante in IT/EN, sia quelle del backend (errori) sia quelle dell'interfaccia; il test sulle chiavi mancanti passa.
2. **README.md** (funzionalità, se rilevante) e **CHANGELOG.md** (voce dell'intervento, più recente in alto, nella lingua scelta per il progetto), come da `core.md` §5b.
3. **ADR** in `docs/adr/` solo se la feature ha richiesto una decisione che devia dalle regole.
4. Aggiornamento della **checklist di consegna** (`core.md` §0b) e controllo finale: nessun segreto, nessun file generato non voluto, `git status` pulito dai file estranei.

## 6. Sequenza dei commit
Segue `git.md` (serie di commit piccoli, ciascuno che builda e passa i test, test in commit `test(scope)` separati). Con più commit si usa il flusso "piano e passo-passo" di `git.md`: elenco dei commit, uno alla volta, conferma dopo ciascuno. Ordine tipico:
1. `feat(scope)`: entità, configurazione EF e migrazione (+ servizio, se piccolo);
2. `feat(scope)`: DTO, validatori, endpoint e il servizio (se non già nel commit 1);
3. `test(scope)`: test backend (unit, integrazione nel progetto `IntegrationTests`, isolamento);
4. `chore(scope)` o `build(scope)`: schema OpenAPI e client rigenerato (commit separato, perché è codice generato);
5. `feat(scope)`: servizio dati, componenti e pagine, con le chiavi di traduzione dell'interfaccia;
6. `test(scope)`: test frontend (unit, E2E, accessibilità);
7. `docs(scope)`: README e CHANGELOG, ADR se serve.
Il push è dell'utente: i punti naturali per un push intermedio sono la fine della fase 1 (backend verde) e la fine della fase 3.

## 7. Cosa non fare
- Non clonare l'entità di riferimento (campi, nomi, regole di business): se ne riprendono solo le convenzioni comuni, confermate con l'utente.
- Non iniziare il frontend prima che il backend sia verde e lo schema sia stato rigenerato.
- Non modificare a mano il client generato né aggirarlo con chiamate manuali.
- Non fondere fasi diverse in un solo commit, né committare codice generato insieme a codice scritto a mano.
- Non saltare le fasi 2 e 4 "perché la modifica è piccola": per una modifica davvero piccola si usa il piano normale, non questa ricetta.
