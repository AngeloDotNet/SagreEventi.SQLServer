---
paths:
  - "**/*.{cs,csproj,props}"
---

# Regole Backend: logica applicativa e infrastruttura

> Richiede `core.md` e `backend.md`. Si carica insieme a `backend.md` sui file `*.cs`, `*.csproj`, `*.props`. Contiene §4: errori e risposte API (4.1), concorrenza (4.2), paginazione (4.3), database ed EF Core (4.4), integration test (4.5), utente corrente e proprietà (4.6); la numerazione dei paragrafi è quella storica di `backend.md`.

## 4. Logica Applicativa e Infrastruttura

### 4.1 Errori e Risposte API Uniformi
- **Libreria di gestione errori (vedi §1):** i servizi restituiscono risultati di errore tipizzati, mappati su HTTP dalla libreria di Minerva: `Result.Fail(FailureReasons.ClientError, ...)` o `FailureReasons.ItemNotFound`, mappati tramite `OperationResults.AspNetCore.Http`. Le risposte di errore personalizzate rispettano la configurazione di `System.Text.Json`.
- **Formato:** la libreria scelta è configurata per produrre `ProblemDetails` (vedi `core.md`). Anche le eccezioni intercettate da `IExceptionHandler` escono come `ProblemDetails`.
- **Chiavi, mai testo:** vale la regola di `core.md`: errori di validazione e di business contengono chiavi di traduzione, non testo localizzato.
- **Mappatura risultato → HTTP (standard di progetto):**
  | Situazione | Motivo (`FailureReasons` o equivalente) | HTTP |
  |---|---|---|
  | Risorsa inesistente (o non visibile all'utente, anti-IDOR) | `ItemNotFound` | 404 |
  | Richiesta malformata o parametri non validi | `ClientError` | 400 |
  | Validazione dei campi (FluentValidation) | errori per campo | 400 con `ProblemDetails` e `errors` |
  | Violazione di una regola di business su richiesta ben formata | `ClientError` con chiave di dominio | 422 |
  | Non autenticato | — | 401 |
  | Autenticato ma non autorizzato | — | 403 |
  | Conflitto di concorrenza o vincolo unique | — | 409 |
  | Precondizione `If-Match` (ETag/`rowversion`) non soddisfatta | — | 412 |
  | Errore imprevisto | eccezione | 500 (`IExceptionHandler`, nessun dettaglio) |
  La libreria scelta (§1) può non distinguere 400 e 422 di default: Claude verifica nella versione installata come ottenere il 422 (personalizzazione della mappatura o un motivo dedicato) e lo configura in un solo punto, senza `if` sparsi negli endpoint. Se un progetto esistente usa una mappatura diversa, la mantiene come deroga dichiarata nel `CLAUDE.md`.
- **Eccezioni e flusso normale:** gli esiti attesi (non trovato, validazione, regola violata, conflitto) sono **risultati**, non eccezioni. Le eccezioni si usano solo per condizioni eccezionali o per bug (invarianti violate nel codice, infrastruttura non raggiungibile) e arrivano all'`IExceptionHandler`. Mai `try/catch` che ingoia un'eccezione o la converte in un risultato senza motivo e senza log; mai `catch (Exception)` generico fuori dai confini (handler globale, job in background, consumer).
- **Conflitti di concorrenza e vincoli del database:** `DbUpdateConcurrencyException` e le violazioni di indici unique (`DbUpdateException` con l'errore del provider, riconosciuto in un solo punto per motore: SQL Server o PostgreSQL) si traducono in un risultato di conflitto → 409 con chiave di traduzione (es. `ERROR_CONCURRENCY_CONFLICT`, `ERROR_<ENTITY>_ALREADY_EXISTS`), mai in un 500 né con il messaggio del database. Il controllo "esiste già?" prima dell'inserimento non sostituisce il vincolo unique nel database (§7): resta come cortesia, il vincolo è la garanzia. Test dedicato per ciascun caso (integration test su database reale, §4.5).

### 4.2 Concorrenza e Integrità dei Dati
- **Concorrenza ottimistica:** concurrency token (`rowversion` su SQL Server, `xmin` su PostgreSQL) sulle entità modificabili. Il conflitto restituisce 409; se il client invia `If-Match` (ETag o `rowversion`) e la precondizione non è soddisfatta, 412. In entrambi i casi la UI propone di ricaricare.
- **Idempotenza:** per operazioni critiche (pagamenti, ordini) usa chiavi di idempotenza.
- **Transazioni:** esplicite quando più scritture devono essere atomiche.

### 4.3 Paginazione, Filtri e Ordinamento
- **Modello unificato (query string):** parametri e risposta come da `core.md` §1; `sortDirection` accetta ASC/DESC; i filtri seguono una convenzione unica.
- **Limiti:** `pageSize` ha un valore predefinito e un massimo imposti dal server (valori in configurazione, per esempio 20 e 100); un valore sopra il massimo o minore di 1 è rifiutato con 400 (o ridotto al massimo, scelta unica per progetto), mai usato così com'è. Anche `pageNumber` ha un tetto ragionevole, e un `totalCount` costoso su tabelle grandi si valuta (keyset). Altri abusi di risorse: `security.md`, «Abuso di risorse».
- **Sicurezza:** `sortBy` e i campi filtro passano da una allow-list, mai usati direttamente in query dinamiche.
- **Dataset molto grandi:** valuta la keyset pagination.

### 4.4 Database ed EF Core
- **Migrazioni:** sempre versionate; mai `EnsureCreated`; mai modificare migrazioni già applicate. Si applicano da codice all'avvio del container del backend (`Database.MigrateAsync()`), prima che l'app inizi a servire richieste; nessuno step dedicato di CI/CD né servizio one-shot nel compose (vedi `docker.md`).
- **Privilegi:** l'app serve le richieste con un utente a privilegi minimi (DML sì, DDL no); mai con il proprietario dello schema. Le migrazioni usano un **utente separato con DDL**, in ogni progetto (a prescindere dal livello ASVS): una seconda stringa di connessione (`ConnectionStrings:Migrations`, valore reale solo da variabile d'ambiente valorizzata da `.env`, voce in `.env.example`), usata solo da `Database.MigrateAsync()` all'avvio e mai per servire richieste.
- **Letture:** `AsNoTracking` e proiezioni con `Select` verso DTO. Vietato N+1; indici definiti esplicitamente.
- **Query raw:** solo parametrizzate.
- **Soft delete / multi-tenancy:** se previsti, via global query filter, decisi una volta sola per progetto.
- **Audit:** campi `CreatedAt/By`, `UpdatedAt/By` e audit trail sulle entità critiche.

### 4.5 Integration test e database di prova
- **Niente Testcontainers né tecnologie simili:** gli integration test non avviano container né orchestrano risorse da codice; usano l'istanza di database di prova descritta sotto.
- **Progetto dedicato:** `[Solution].IntegrationTests` (xUnit), separato dagli unit test; referenzia l'`Api` e usa `WebApplicationFactory<Program>` (vedi §2, `Program` accessibile).
- **Database reale di prova:** stesso motore del progetto, su un'istanza locale già esistente (o server di prova indicato dall'utente). La connection string arriva da User Secrets o dalla variabile `ConnectionStrings__Test`, mai dal repository né da `appsettings.json` con valori reali. Mai il database di sviluppo né di produzione.
- **Isolamento:** a ogni esecuzione dei test si crea un database con nome univoco (es. suffisso `Guid`), si applicano le migrazioni e a fine esecuzione lo si elimina (anche in caso di fallimento: fixture di collezione/assembly con `IAsyncLifetime`). I test dentro la stessa esecuzione non condividono dati: ognuno crea i propri (builder/fixture, id e tenant univoci) e non dipende dall'ordine.
- **Privilegi:** l'utente usato dai test può creare ed eliminare database; è distinto dall'utente applicativo (privilegi minimi, §4.4) e non è mai usato fuori dai test.
- **Mock di `DbContext` e `DbSet` (opzionale, solo unit test di logica):** si usa solo se il `CLAUDE.md` lo dichiara (voce «Mock EF nei test unitari», default: no). Il mock vale solo per la logica che non tocca il `DbContext` (validatori, calcoli su DTO, regole di dominio). Un servizio che legge dal `DbContext` si prova sempre sul database reale di prova, anche se la sua logica è semplice: query, vincoli del database e traduzione LINQ non sono verificabili con un mock. `InMemory` resta vietato in ogni caso.
- **Pipeline:** la CI richiede un'istanza del motore raggiungibile e la sua connection string come segreto; se non disponibile, i test non si saltano in silenzio ma falliscono con un messaggio che nomina la variabile mancante.

### 4.6 Utente corrente e controlli di proprietà
Si applica ai progetti con autenticazione (decisa secondo `security.md`); senza autenticazione la sezione non c'è. Completa la regola anti-IDOR di `security.md` ("ogni query filtra per utente o tenant").
- **`ICurrentUser`:** astrazione che espone `UserId`, `TenantId` (se multi-tenancy), ruoli/claim necessari e `IsAuthenticated`. Definita in `Application` (in VSA nel progetto condiviso) nella cartella `Interfaces/`, implementata in `Api` leggendo `HttpContext.User` tramite `IHttpContextAccessor`; nei job in background e nei consumer non c'è un utente di richiesta: l'identità si passa esplicitamente nel messaggio o nel job, mai letta da un contesto ambientale. Nei test è sostituita da una implementazione fissa.
- **Filtro nel servizio, non nell'endpoint:** i servizi (o le slice) applicano il filtro per proprietario/tenant a **ogni** query e comando che tocca dati di un utente (`Where(x => x.OwnerId == currentUser.UserId)`), così l'endpoint non contiene controlli di proprietà e non si può dimenticare chiamandolo da un altro punto. Il tenant si applica con il global query filter (§4.4) alimentato da `ICurrentUser`; il filtro per proprietario di un'entità è un metodo di estensione riusabile (§2c).
- **Risorsa altrui = non trovata (default):** una risorsa che esiste ma non appartiene all'utente produce `ItemNotFound` (404), non 403, per non rivelarne l'esistenza (§4.1). Il 403 resta per le azioni vietate su risorse visibili. Un progetto può derogare con il 403 (es. applicazioni interne dove la UX conta più dell'anti-enumerazione) solo annotandolo nel `CLAUDE.md`; i test di §4.6 si adeguano al codice scelto.
- **Proprietà impostate dal server:** `OwnerId`, `TenantId` e simili vengono da `ICurrentUser`, mai dal DTO di richiesta (vedi mass assignment in `security.md`).
- **Autorizzazione per risorsa (solo con permessi granulari):** se `security.md` ha portato alla scelta di permessi granulari per risorsa/azione, si usano policy con `IAuthorizationHandler` e `IAuthorizationService.AuthorizeAsync(user, resource, policy)` nel servizio; con le sole scelte "solo autenticazione", ruoli o policy su claim bastano `ICurrentUser` e il filtro. Il motivo dell'eventuale handler per risorsa va nel `CLAUDE.md`.
- **`IgnoreQueryFilters` e RLS:** ogni uso di `IgnoreQueryFilters` è un'eccezione motivata e rivista; su PostgreSQL la Row-Level Security è la difesa in profondità raccomandata per le tabelle multi-tenant (`security.md`, «Autenticazione e Autorizzazione»).
- **Test:** per ogni risorsa di un utente, un integration test (§4.5) che verifica che un secondo utente (e un secondo tenant) non possa leggerla, modificarla né eliminarla (404), oltre ai test di ruolo/policy.
