---
paths:
  - "**/*.{cs,csproj,props}"
---

# Regole Backend (.NET 10, Architettura & Dati)

> Richiede `core.md` (contratto con il frontend, licenze, workflow). Per la sicurezza vedi anche `security.md`.

## 1. Stack Backend
- **Runtime:** .NET 10 Web API, C# 14.
- **Serializzazione JSON:** `System.Text.Json` (NO Newtonsoft.Json).
- **Architettura:** Vertical Slice Architecture (§2a) o Clean Architecture (§2b), alla pari. Si decide una volta per progetto (vedi `core.md` §6.4) e la scelta sta nel `CLAUDE.md`; in un progetto esistente si rileva dal codice e si conferma con l'utente.
- **ORM:** Entity Framework Core 10 è il default. **Dapper è l'alternativa da valutare ogni volta**, mai una scelta scontata né da copiare dal progetto precedente: all'avvio si chiede quale usare; se in corso d'opera emerge un caso che sembra adatto (query di lettura molto complesse o critiche per prestazioni, report, operazioni bulk) Claude lo propone con motivazione e **aspetta conferma**, senza introdurlo di sua iniziativa. Se si adotta Dapper (da solo o accanto a EF Core), l'utente decide come gestire schema e migrazioni (le regole di §4.4 valgono per EF Core) e la scelta va nel `CLAUDE.md`; Claude verifica la licenza (vedi `core.md` §3). Le query restano sempre parametrizzate (mai concatenazione di stringhe SQL).
- **Database:** il motore (SQL Server o PostgreSQL) si **chiede sempre** a ogni progetto: mai darlo per scontato né copiarlo dal progetto precedente. Dalla risposta dipende il provider NuGet di EF Core (`Microsoft.EntityFrameworkCore.SqlServer`, `Npgsql.EntityFrameworkCore.PostgreSQL`). MySQL è escluso per ora. La scelta va nel `CLAUDE.md`.
- **Finiture:** NO MediatR (approccio custom), NO AutoMapper (mapping manuale tramite metodi di estensione).
- **Gestione Errori/Risposte:** per ogni sviluppo backend (solo API o fullstack) **chiedi ogni volta** quale libreria usare per il core business e l'integrazione con le Minimal API, senza darlo per scontato né copiarlo dal progetto precedente. Le due opzioni sono:
  - `OperationResults` di Marco Minerva (https://github.com/marcominerva/OperationResults);
  - `OperationResults` di AppEngine (https://github.com/AngeloDotNet/AppEngine/tree/main/src/AppEngine.Tools/OperationResults): è una versione "congelata" derivata dalla libreria di Minerva, con codice pressoché identico e utilizzo simile.
  Gli esempi e i nomi di queste regole (`Result<T>`, `FailureReasons`, `AddOperationResult()`, `CreateResponse(result)`) valgono quindi per entrambe, ma ciò non esime dal controllo: dopo la scelta, e prima di scrivere codice, verifica nel repository e nella versione installata nome del pacchetto NuGet, namespace e firme delle API effettivamente usate (possono differire in dettagli, e la versione di Minerva continua a evolversi mentre quella di AppEngine no), oltre alla licenza (vedi `core.md` §3). La scelta va nel `CLAUDE.md`.

---

## 2. Regole Backend
- **Struttura API:** si preferiscono le **Minimal API** ai Controller, con metodi di estensione e `MapGroup`. I Controller classici si usano solo se l'utente li chiede o se un requisito tecnico li impone (es. una libreria che li richiede): in quel caso Claude lo segnala e chiede conferma, non li introduce di iniziativa e non mescola i due stili nello stesso progetto senza averlo concordato.
- **Punto di ingresso senza top-level statements:** `Program.cs` non usa i top-level statements: contiene una classe `Program` con un metodo `Main` esplicito (`static async Task Main(string[] args)` o `static void Main`) che costruisce e avvia l'host. La configurazione dei servizi e della pipeline sta in metodi di estensione richiamati da `Main` (o in metodi privati statici dedicati), non tutta in un unico blocco. Per i test di integrazione con `WebApplicationFactory<Program>` la classe `Program` deve essere accessibile ai test (pubblica oppure `InternalsVisibleTo`).
- **C# 14 / .NET 10:** Primary Constructors, Collection Expressions, Implicit Spans. `Nullable` abilitato e `TreatWarningsAsErrors`.
- **Asincronismo:** `async/await` ovunque.
- **`CancellationToken`:** va accettato e propagato **ogni volta che è possibile e ha senso**, lungo tutta la catena: parametro `CancellationToken` negli endpoint Minimal API (lo associa il framework a `HttpContext.RequestAborted`), poi in handler/servizi, query e `SaveChangesAsync` di EF Core, `HttpClient`, client RabbitMQ, invio email e qualunque altra chiamata di I/O. Ogni metodo asincrono pubblico che esegue I/O lo riceve come ultimo parametro; nei `BackgroundService`/hosted service si usa lo `stoppingToken` (vedi `core.md` §5, shutdown). Non lo si passa o si usa `CancellationToken.None` solo quando l'operazione deve concludersi comunque (es. commit già avviato, scrittura dell'outbox, audit, compensazioni) e il motivo sta in un commento. Una `OperationCanceledException` dovuta all'annullamento della richiesta non è un errore applicativo: non produce un 500 né un log di errore (vedi l'`IExceptionHandler`).
- **Validazione:** **si preferisce `FluentValidation` alle Data Annotation** in tutti gli sviluppi backend. I DTO in ingresso si validano con `AbstractValidator<T>` (regole fuori dal DTO, testabili in isolamento), con messaggi basati su chiavi di traduzione (`WithMessage("ERROR_FIELD_REQUIRED")`). I DTO e le entità non portano attributi di validazione (`[Required]`, `[StringLength]`, `[Range]`, ecc.). Lo stesso criterio vale per la validazione delle Options (`ValidateOnStart`): si preferisce `IValidateOptions<T>` (anche con un validatore FluentValidation al suo interno) agli attributi `[Required]` sulla classe. Le Data Annotation restano ammesse solo dove un framework le richiede o dove sono nettamente più semplici (es. attributi richiesti da una libreria esterna; la configurazione della persistenza resta in `IEntityTypeConfiguration`, mai come attributi sul modello): in quel caso Claude **lo segnala e chiede conferma**, non le introduce di iniziativa. Prima dell'uso Claude verifica versione e licenza di FluentValidation (vedi `core.md` §3) e non mescola i due approcci sullo stesso DTO.
- **Versionamento:** `Asp.Versioning` (es. `/api/v1/...`).
- **OpenAPI:** il supporto è **sempre abilitato** nei progetti con API: documentazione nativa (`AddOpenApi` e `MapOpenApi`), con commenti XML sugli endpoint (vedi `core.md` §5b), tipi di risposta dichiarati (`Produces`/`ProducesProblem`) e schema usabile per generare i client (`core.md` §1). **UI interattiva solo in ambiente Development, con Swagger UI come scelta preferita** (pacchetto `Swashbuckle.AspNetCore.SwaggerUI`, che legge il documento nativo, senza usare il generatore di Swashbuckle); **Scalar** solo se l'utente lo chiede. Se l'API è autenticata, la UI deve permettere di inserire il token. In produzione la UI non è mai esposta. **L'esposizione del documento OpenAPI** (endpoint `/openapi/...`) fuori da Development **si chiede ogni volta, a ogni progetto**, senza regola fissa e senza copiare la risposta dal progetto precedente: le opzioni sono nessuna esposizione (lo schema si genera solo in fase di build), esposizione solo in Development, oppure esposizione anche in produzione (eventualmente protetta da autorizzazione); la scelta va nel `CLAUDE.md` (campo "Esposizione OpenAPI"). Prima dell'uso Claude verifica versione e licenza dei pacchetti (`core.md` §3).
- **Principi SOLID:** il codice backend si progetta secondo SOLID (una responsabilità per tipo, dipendenze da astrazioni dove servono, tipi estendibili senza modificarli). SOLID è un criterio, non una cerimonia: per le classi che **non** sono service (vedi "Service e interfacce") niente interfaccia per una classe con una sola implementazione senza un motivo dichiarato (testabilità reale, confine di livello in Clean, più implementazioni), in linea con `core.md` §6.17 e §2c.
- **Service e interfacce (MUST):** ogni classe service (servizio applicativo o di dominio con la logica dei casi d'uso, in Clean i servizi di `Application`; in VSA il Handler/Service della slice quando la forma scelta è un service) **implementa un'interfaccia dedicata** (`IProductService` per `ProductService`) e la **registrazione nella dependency injection usa entrambe** (`services.AddScoped<IProductService, ProductService>()`, o il lifetime appropriato): mai la sola classe concreta, né iniezione della classe al posto dell'interfaccia. Vale anche con una sola implementazione: qui l'eccezione di SOLID sopra non si applica. Gli handler di una slice che non hanno forma di service restano liberi (§2a).
- **Registrazione in blocco con Scrutor (PREFER):** quando i service da registrare con lo **stesso lifetime** sono più di uno, si usa il pacchetto NuGet **Scrutor** (scansione e decorazione per la DI nativa di .NET) invece di una riga `AddScoped` per ciascuno: `services.Scan(scan => scan.FromAssemblyOf<...>().AddClasses(c => c.InNamespaceOf<...>()).AsImplementedInterfaces().WithScopedLifetime())`, con il filtro più stretto possibile (namespace o suffisso `Service`), così da non registrare tipi non voluti; un gruppo di scansione per lifetime. Un solo service, o lifetime e registrazioni diversi per caso, restano registrazioni esplicite. Le scansioni stanno nei metodi di estensione di composizione (`AddApplication()`, `AddInfrastructure()`), mai in `Program.cs`. Scrutor è una dipendenza da dichiarare (nome, versione, motivo, `core.md` §6.8); licenza MIT per quanto noto, da verificare sul repository ufficiale al primo uso (`core.md` §3), non a memoria; compatibilità con .NET 10 da verificare. Un test (unit o di integrazione) controlla che ogni interfaccia di service si risolva dal container. Se manca un'interfaccia o il lifetime non è chiaro, vale la regola precedente: si ferma e si chiede.
- **Cartella `Interfaces/` (MUST):** le interfacce definite dal progetto (service, repository, `IApplicationDbContext`, `ICurrentUser`, `IEmailSender`, ecc.) stanno in **una sola cartella `Interfaces/` alla radice del progetto che le contiene**, anche in Vertical Slice (non dentro la slice) e anche in `Domain`; se diventano molte, sottocartelle per area dentro `Interfaces/`. Le implementazioni restano dove prevede l'architettura (area o slice in `Application`/`Api`, `Infrastructure` per i servizi di infrastruttura). Sono escluse le interfacce dei framework che il progetto solo implementa (`IEntityTypeConfiguration<T>`, `IExceptionHandler`, `IValidateOptions<T>`).
- **Expression body (MUST, regola generale):** ogni metodo (e proprietà o operatore) il cui corpo è una sola espressione si scrive con expression body (`=>`), **qualunque sia la firma** (numero e lunghezza dei parametri, tipo di ritorno, generici), a partire dagli endpoint Minimal API (metodi statici che delegano al service); vale per tutto il codice C#, non solo per le API. Il blocco si usa solo quando il corpo richiede più istruzioni: la leggibilità o la lunghezza della firma non sono un motivo per derogare.
- **Using inutilizzati (MUST):** al termine degli sviluppi, dopo aver verificato che la build termini senza errori, si rimuovono gli `using` non necessari (es. `dotnet format style --diagnostics IDE0005`, o l'equivalente dell'IDE), poi si riesegue la build. Vale per tutti i progetti backend.
- **Cartella `Validators/` (MUST):** le classi di validazione (`AbstractValidator<T>`) stanno tutte in **una sola cartella `Validators/` per progetto**, senza sottocartelle per entità o funzionalità; il namespace segue la cartella. In Clean Architecture la cartella è nel progetto `Application`; in Vertical Slice è nel progetto API, accanto alla cartella delle slice (anche qui, non dentro la slice).
- **Cartella `Options/` (MUST):** le classi Options (pattern Options con `ValidateOnStart`, inclusi i relativi `IValidateOptions<T>`) stanno tutte in **una sola cartella `Options/` per progetto che le contiene**, senza sottocartelle; il namespace segue la cartella. In Clean Architecture ogni classe sta nel progetto che la usa (es. SMTP, Redis e JWT in `Infrastructure/Options/`, quelle solo applicative in `Application/Options/`); in Vertical Slice la cartella è nel progetto API.
- **Cartelle `Requests/` e `Responses/` (MUST):** i tipi di richiesta (`record` DTO di input) stanno in una cartella `Requests/` e quelli di risposta in una cartella `Responses/`, **una per progetto**, senza sottocartelle per funzionalità; il namespace segue la cartella. In Clean Architecture sono nel progetto `Application`; in Vertical Slice nel progetto API, accanto alla cartella delle slice.
- **Eccezioni globali:** `IExceptionHandler` + `ProblemDetails` (RFC 9457) con `traceId`. Stack trace e messaggi di eccezione compaiono solo in ambiente Development; in qualsiasi altro ambiente (Staging incluso) nessun dettaglio interno nella risposta.
- **Configurazione:** pattern Options con `ValidateOnStart`. File di configurazione per ambiente.
- **Variabili d'ambiente:** nomi nel formato di ASP.NET Core `Sezione__Chiave` (doppio underscore), che corrispondono alle sezioni Options (es. `ConnectionStrings__Default`, `Redis__Password`). Nessun prefisso inventato per progetto. Ogni variabile richiesta compare in `.env.example` con un valore finto e un commento; le Options obbligatorie falliscono all'avvio (`ValidateOnStart`) con un messaggio che nomina la variabile mancante.
- **Resilienza:** `Microsoft.Extensions.Http.Resilience` per le chiamate a servizi esterni.
- **Tempo:** usa `TimeProvider` (iniettato) invece di `DateTime.UtcNow` / `DateTimeOffset.UtcNow`, per test deterministici.
- **Enum in JSON:** `JsonStringEnumConverter` come standard, mai numeri.
- **Identificatori:** `Guid.CreateVersion7()` (ordinabile, adatto agli indici) oppure `long` generato dal DB. Mai GUID casuali come chiave clusterizzata su SQL Server.
- **Denaro e quantità esatte:** sempre `decimal` con precisione e scala esplicite nel mapping EF; mai `double`/`float`.
- **Pacchetti:** Central Package Management (`Directory.Packages.props`), `Directory.Build.props` per le impostazioni comuni, `global.json` per fissare l'SDK. Lock file committati (`packages.lock.json` con `RestorePackagesWithLockFile`; `package-lock.json` con `npm ci` in CI se c'è un frontend).
- **Lavori in background:** le opzioni sono `BackgroundService` di .NET (compiti semplici in memoria), gli **hosted service** (`IHostedService`, per logica di avvio/arresto che non è un ciclo continuo) e **Coravel**. Quartz.NET e Hangfire non si usano. Mai `Task.Run` fire-and-forget dentro una richiesta.
  - **Natura dei job:** i job in background non sono solo di invio email; possono svolgere qualunque attività (es. generare archivi zip schedulati, pulizie, import/export, report). Gli strumenti elencati sopra (`BackgroundService`, hosted service, Coravel) non sono legati all'invio email: si valutano per qualunque attività in background, e le regole di questo punto valgono per ogni job. **Il tipo di job si chiede ogni volta** (ricorrente/schedulato, a richiesta, di avvio/arresto, ecc.), senza darlo per scontato; il job va scritto idempotente.
  - **Decisione sempre esplicita:** quando serve un job in background, Claude **chiede** (a) di che tipo è il job e quale strumento usare tra `BackgroundService`, hosted service e Coravel, illustrando in breve i compromessi (persistenza, clustering, retry integrato), e (b) **se prevedere un retry** e con quale politica (numero di tentativi, backoff, cosa fare dopo l'ultimo fallimento). Non presume la risposta dal progetto precedente; in caso di dubbio su una delle due scelte, chiede. La risposta va nel `CLAUDE.md` (campo "Job in background").
  - Prima di proporre Coravel verifica licenza (MIT) e compatibilità con .NET 10, come per ogni nuova dipendenza.
- **Real-time:** se serve, SignalR autenticato, con gruppi per utente/tenant. Nessun canale pubblico per dati riservati.
- **Email e notifiche:** dietro un'astrazione (`IEmailSender`), template localizzati dal database, mai invio sincrono nella richiesta; libreria, disaccoppiamento (coda o job) e outbox/retry si decidono secondo `backend-email.md`.
- **File storage:** dietro un'astrazione (disco su volume Docker, oppure MinIO come opzione). **Non scegliere mai lo storage da solo:** se il progetto ha bisogno di file e il `CLAUDE.md` non specifica la scelta, chiedi ogni volta se usare MinIO o un'alternativa (disco su volume Docker o altro storage self-hosted gratuito, con licenza verificata). MinIO si introduce solo dopo conferma esplicita. Mai servizi cloud a pagamento come Azure Blob o AWS S3. Nel database solo chiavi o percorsi relativi, mai percorsi assoluti.
- **Caching HTTP:** `ETag` / `Cache-Control` per risorse statiche e dizionari; mai cache su risposte con dati utente senza `Vary` o `private`.

### 2a. Vertical Slice Architecture
- Codice organizzato per **Feature** in una cartella (es. `Features/Products/CreateProduct`).
- Ogni slice contiene:
  - Endpoint Minimal API (che converte il risultato in risposta HTTP con la libreria di gestione errori scelta, es. `httpContext.CreateResponse(result)` in quella di Minerva).
  - DTO di richiesta/risposta (`record`): per feature, ma i file stanno nelle cartelle condivise `Requests/` e `Responses/` del progetto, non dentro la slice (§2).
  - Validatore (`AbstractValidator`): il file sta nella cartella condivisa `Validators/` del progetto, non dentro la slice (§2).
  - Handler/Service custom dedicato alla feature, che restituisce il tipo di risultato della libreria scelta (es. `Result<T>` o `Result`). La forma (firma, handler o service) è libera: la decide ogni progetto e la annota nel `CLAUDE.md`; se è un service, interfaccia e registrazione nella DI con entrambi i tipi sono obbligatorie (§2, "Service e interfacce"). Resta fermo il divieto di MediatR e di mediator di terze parti.
  - Classe statica con i metodi di estensione per il mapping manuale.
- **Dati nelle slice:** la slice usa il `DbContext` direttamente; il repository è opzionale come in Clean, secondo i criteri e la conferma di §2c. Entità, `DbContext` e configurazioni EF stanno in una cartella condivisa (es. `Data/`), mai dentro una slice; le interfacce (anche quella del service della slice) stanno in `Interfaces/` alla radice del progetto, non nella slice; una slice non referenzia un'altra slice: il codice condiviso si estrae in `Common/` o `Shared/` solo quando serve ad almeno due slice.

### 2b. Clean Architecture
Quattro progetti, con questi nomi (il prefisso della solution sta nel `CLAUDE.md`): `Domain`, `Application`, `Infrastructure`, `Api`. Un progetto esistente che usa nomi diversi (es. `Data` per l'infrastruttura, `Web` per l'host) li mantiene come deroga finché una rinomina non è pianificata in `PIANO.md`.

- **Regola delle dipendenze:** le dipendenze puntano verso l'interno. `Domain` non referenzia nulla; `Application` referenzia solo `Domain`; `Infrastructure` referenzia `Application` (e quindi `Domain`); `Api` referenzia `Application` e `Infrastructure` (solo per la composizione della DI in `Program.cs`). Mai `Domain` o `Application` verso `Infrastructure` o `Api`. Il rispetto della regola si verifica a ogni build (riferimenti di progetto) e, dove serve, con test di architettura.
- **Domain:** entità e value object, enum, eccezioni di business, interfacce primitive (es. marcatori per audit, soft delete, tenant). Nessuna dipendenza da EF Core, da ASP.NET Core o da librerie di infrastruttura; nessun attributo di persistenza (la configurazione sta in `Infrastructure`).
- **Modello del dominio: anemico o ricco (opzionale, si chiede a ogni progetto o entità).** Il default per i CRUD semplici è il modello anemico accettato (entità con proprietà, validazione in `Application`). Un **modello ricco** si adotta solo dopo conferma, per le entità con regole di business e invarianti reali; la scelta va nel `CLAUDE.md`. In quel caso:
  - l'entità protegge le proprie invarianti: setter privati, costruttore privato o `internal` e **factory** statica (`Create(...)`) che valida e segnala le invarianti violate con un'**eccezione di dominio** (mai per l'input utente, già validato in `Application`, vedi §4.1; il servizio la converte in risultato 422) oppure, solo come deroga annotata nel `CLAUDE.md` che accetta in `Domain` la dipendenza dalla libreria dei risultati, restituendo il tipo di risultato della libreria scelta (altrimenti `Domain` non referenzia nulla); le modifiche passano da metodi con nome di business (`Confirm()`, `Cancel(reason)`), non da setter pubblici;
  - **value object** (`record` immutabili, uguaglianza per valore) per i concetti con regole proprie (es. `Email`, `Money`, `DateRange`), mappati in EF Core con `ComplexProperty` o `OwnsOne` in `Infrastructure`;
  - **aggregati**: una root che garantisce la coerenza dei figli, riferimenti tra aggregati solo per identificatore (mai navigazioni verso altre root), e una transazione per aggregato;
  - **eventi di dominio** solo se servono davvero (effetti collaterali disaccoppiati): la root li accumula, vengono pubblicati dopo il `SaveChanges` secondo `backend-infra.md` (outbox se l'effetto deve essere garantito); mai un dispatcher in memoria che esegue logica di business dentro la stessa transazione senza averlo concordato;
  - la mappatura EF Core su costruttori e campi privati sta nelle `IEntityTypeConfiguration<T>`; la logica di dominio si prova con unit test puri, senza database.
- **Application:** casi d'uso come servizi (un servizio per area funzionale o per entità) che restituiscono il tipo di risultato della libreria scelta (es. `Result<T>`), DTO (`record`), validatori `AbstractValidator`, mapping manuale con metodi di estensione, e le **interfacce** richieste dai casi d'uso (accesso ai dati, `IEmailSender`, storage, `TimeProvider` dove serve). Contiene anche un metodo di estensione `AddApplication()` che registra servizi (interfaccia e classe, §2) e validatori. Non conosce HTTP né il database concreto.
- **Accesso ai dati (default):** `Application` definisce `IApplicationDbContext` (con i `DbSet<T>` necessari, `SaveChangesAsync(CancellationToken)` e, se serve, l'accesso alle transazioni); `Infrastructure` lo implementa con il `DbContext` di EF Core. I servizi usano LINQ sull'interfaccia, con le regole di §4.4 (`AsNoTracking`, proiezioni verso DTO). Per questo `Application` può referenziare il pacchetto `Microsoft.EntityFrameworkCore` per i soli metodi di estensione LINQ asincroni (`ToListAsync`, ecc.), mai i provider (`SqlServer`, `Npgsql`) né il tipo concreto del `DbContext`. Nessun repository per ogni entità e nessuna Unit of Work separata: il `DbContext` è già entrambi.
- **Repository generico di base (facoltativo, da valutare a ogni progetto; criteri e alternative in §2c):** non si introduce di default. Se l'utente lo vuole, ad esempio per dare a ogni entità lo stesso CRUD, Claude lo propone con motivazione e **aspetta conferma**, come per Dapper (§1). In quel caso: interfaccia `IRepository<T>` in `Application` (o in `Domain` se i casi d'uso lo richiedono), implementazione `Repository<T>` in `Infrastructure` sopra `IApplicationDbContext`/`DbContext`, repository specifici solo dove la logica di query è non banale, nessun `IQueryable` esposto oltre il servizio. La scelta (no/sì) va nel `CLAUDE.md`.
- **Infrastructure:** `DbContext` EF Core e relative configurazioni (`IEntityTypeConfiguration<T>` in cartella dedicata), migrazioni, implementazioni delle interfacce di `Application` (email, storage, messaggistica, cache), Identity se previsto, e un metodo di estensione `AddInfrastructure(IConfiguration)` che registra provider, `DbContext`, implementazioni e Options. Le migrazioni stanno qui (o nel progetto indicato nel `CLAUDE.md`), con `--startup-project` verso `Api`.
- **Api:** punto di ingresso e composizione. Endpoint Minimal API raggruppati per area con `MapGroup` e metodi di estensione, che chiamano i servizi di `Application` e convertono il risultato in HTTP con la libreria scelta (es. `httpContext.CreateResponse(result)` in quella di Minerva, con `builder.Services.AddOperationResult()` nella registrazione), `IExceptionHandler`, versionamento, OpenAPI, CORS, health check, autenticazione/autorizzazione, rate limiting e `Program.cs`. Nessuna logica di business negli endpoint.
- **Dove sta cosa (riepilogo):**
  | Elemento | Livello |
  |---|---|
  | Entità, enum, eccezioni di business | `Domain` |
  | DTO, validatori, mapping, servizi, interfacce dei casi d'uso | `Application` |
  | `DbContext`, configurazioni EF, migrazioni, email/storage/messaggistica, cache | `Infrastructure` |
  | Endpoint, `Program.cs`, middleware, OpenAPI, sicurezza HTTP | `Api` |
- **Struttura interna:** in `Application` e in `Api` le cartelle sono per area funzionale (es. `Products/`), non per tipo tecnico a livello radice, con le uniche eccezioni di `Interfaces/`, `Validators/`, `Options/`, `Requests/` e `Responses/` (§2, regole omonime), presenti alla radice di ogni progetto che definisce tipi di quella categoria; in `Domain` e `Infrastructure` per tipo (`Entities/`, `Configurations/`).
- **Test:** unit test su validatori, mapping e logica dei servizi che non tocca il database, con le altre dipendenze sostituite; i servizi che interrogano `IApplicationDbContext` si provano contro un database reale nel progetto di integration test (§4.5; SQLite solo se concordato secondo `core.md` §4; mai EF Core InMemory, né finti `DbSet`); integration test con `WebApplicationFactory` sull'`Api`, anch'essi nel progetto dedicato.
- **Test di architettura (obbligatori in Clean):** nel progetto degli unit test, test che fanno fallire la build quando la regola delle dipendenze è violata: `Domain` non referenzia nulla di `Application`, `Infrastructure` e `Api`; `Application` non referenzia `Infrastructure` né `Api` e non usa i provider (`SqlServer`, `Npgsql`) né `Microsoft.AspNetCore`; `Domain` non usa EF Core. Si valutano strumenti gratuiti con licenza permissiva (es. `NetArchTest.Rules`, MIT, o `ArchUnitNET`, Apache-2.0): prima dell'uso Claude verifica licenza, versione e compatibilità con .NET 10 (`core.md` §3) e li dichiara come nuova dipendenza. In Vertical Slice sono facoltativi (es. nessuna slice referenzia un'altra), su conferma.

### 2c. Accesso ai dati e pattern (VSA e Clean)
Vale per entrambe le architetture. Principio: **il `DbContext` di EF Core è già repository e Unit of Work**; ogni astrazione in più deve avere un motivo dichiarato, non essere cerimonia.
- **Default:** accesso diretto al `DbContext` (in Clean tramite `IApplicationDbContext`, §2b; in VSA direttamente nella slice), con LINQ, `AsNoTracking` e proiezioni verso DTO (§4.4). Unit of Work = `SaveChangesAsync` (una sola chiamata per caso d'uso) oppure transazione esplicita quando serve (§4.2).
- **Repository: mai di default, in nessuna delle due architetture.** Claude lo propone con motivazione solo se ricorre almeno un criterio e **aspetta conferma**; la scelta (no/sì, ambito) va nel `CLAUDE.md`. Criteri che lo giustificano:
  - più sorgenti dati per lo stesso concetto (EF Core + Dapper, API esterna, cache) da nascondere al caso d'uso;
  - un **aggregato** con invarianti da caricare e salvare per intero (si carica l'aggregato, non le singole tabelle);
  - logica di query non banale e riusata in più casi d'uso, da incapsulare in un solo punto.
- **Forma ammessa se approvato:** un repository **per aggregato**, non per tabella; interfaccia in `Application` (o `Domain` se i casi d'uso la richiedono) nella cartella `Interfaces/` (§2), implementazione in `Infrastructure` (in VSA, nella cartella dell'area che lo usa, o in una cartella condivisa concordata); `IRepository<T>` generico solo secondo §2b. Nessun `IQueryable` esposto fuori dal repository o dal servizio, nessun metodo `Save` nel repository (lo fa il `DbContext`/caso d'uso).
- **Motivazioni che NON bastano:** "poterlo mockare" (i servizi che toccano il database si provano su database reale, §2b e §4.5), "cambiare ORM in futuro", "separare per principio", un wrapper 1:1 dei `DbSet`.
- **Filtri riutilizzabili (default):** metodi di estensione su `IQueryable<T>` (es. `WhereActive()`, `ForTenant(id)`), vicini all'entità o alla feature. Soft delete e tenant restano nei global query filter (§4.4).
- **Specification pattern: opzionale su conferma.** Non di default. Claude lo propone solo quando lo stesso filtro composto compare in **3 o più punti** e i metodi di estensione non bastano; implementazione **custom** (nessuna libreria), valutazione sul `DbContext`, una specification per regola di query, testabile in isolamento. La scelta va nel `CLAUDE.md`.
- **Query object / letture complesse:** per report e letture molto onerose (anche con Dapper, se approvato, §1) una classe dedicata per query (`GetOrdersReportQuery`) che restituisce DTO, parametrizzata e testata su database reale. Non passa dal repository.
- **Scritture in blocco: su conferma.** `ExecuteUpdateAsync`/`ExecuteDeleteAsync` per aggiornamenti e cancellazioni di massa non si usano di iniziativa: Claude le propone con motivazione (volumi grandi, prestazioni misurate) e **aspetta conferma**. Bypassano change tracker, interceptor di audit e concorrenza ottimistica: nella proposta dichiara come vengono garantiti audit, soft delete e concorrenza.

---

## 3. Comunicazione, Mapping & Data Transfer
- **DTO:** ogni richiesta/risposta ha un `record` dedicato. Mai esporre entità EF Core al frontend.
- **Mapping:** solo metodi di estensione statici in classi dedicate. Niente AutoMapper né factory interne ai DTO.
- **Naming:** C# PascalCase per tipi, metodi e proprietà; camelCase per parametri e variabili locali; campi privati `_camelCase`; interfacce con prefisso `I`; metodi asincroni con suffisso `Async` (tranne gli handler degli endpoint).
- **Stile del codice:** file-scoped namespace; un tipo per file, con il nome del file uguale al tipo; `sealed` su classi e record non pensati per l'ereditarietà; **si preferisce `record` (sealed) per i tipi di dati immutabili**: DTO, value object, messaggi ed eventi, comandi/query, Options; `class` per entità EF (identità e change tracking, mai `record`), servizi, handler e tipi con stato mutabile o comportamento; `var` solo quando il tipo è evidente; `using` ordinati (il formato è imposto da `.editorconfig` e dagli analyzer, non a mano).
- **Serializzazione:** configura esclusivamente `System.Text.Json` (`JsonNamingPolicy.CamelCase`) per la conversione automatica.
- **Endpoint REST:** risorse al plurale, kebab-case, verbi HTTP corretti e codici di stato coerenti.

---

## 4. Logica Applicativa e Infrastruttura

### 4.1 Errori e Risposte API Uniformi
- **Libreria di gestione errori (scelta secondo §1):** i servizi restituiscono risultati di errore tipizzati, mappati su HTTP dalla libreria. Con quella di Minerva: `Result.Fail(FailureReasons.ClientError, ...)` o `FailureReasons.ItemNotFound`, mappati tramite `OperationResults.AspNetCore.Http`. Con quella di AppEngine l'utilizzo è analogo; verifica però namespace e firme nel repository. Le risposte di errore personalizzate rispettano la configurazione di `System.Text.Json`.
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
- **Limiti:** `pageSize` ha un massimo imposto dal server.
- **Sicurezza:** `sortBy` e i campi filtro passano da una allow-list, mai usati direttamente in query dinamiche.
- **Dataset molto grandi:** valuta la keyset pagination.

### 4.4 Database ed EF Core
- **Migrazioni:** sempre versionate; mai `EnsureCreated`; mai modificare migrazioni già applicate. In produzione NON si applicano all'avvio dell'app: usa un bundle (`dotnet ef migrations bundle`) o script idempotenti eseguiti da uno step dedicato di CI/CD.
- **Privilegi:** l'app si connette con un utente a privilegi minimi (DML sì, DDL no); mai con il proprietario dello schema.
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
- **Pipeline:** la CI richiede un'istanza del motore raggiungibile e la sua connection string come segreto; se non disponibile, i test non si saltano in silenzio ma falliscono con un messaggio che nomina la variabile mancante.

### 4.6 Utente corrente e controlli di proprietà
Si applica ai progetti con autenticazione (decisa secondo `security.md`); senza autenticazione la sezione non c'è. Completa la regola anti-IDOR di `security.md` ("ogni query filtra per utente o tenant").
- **`ICurrentUser`:** astrazione che espone `UserId`, `TenantId` (se multi-tenancy), ruoli/claim necessari e `IsAuthenticated`. Definita in `Application` (in VSA nel progetto condiviso) nella cartella `Interfaces/`, implementata in `Api` leggendo `HttpContext.User` tramite `IHttpContextAccessor`; nei job in background e nei consumer non c'è un utente di richiesta: l'identità si passa esplicitamente nel messaggio o nel job, mai letta da un contesto ambientale. Nei test è sostituita da una implementazione fissa.
- **Filtro nel servizio, non nell'endpoint:** i servizi (o le slice) applicano il filtro per proprietario/tenant a **ogni** query e comando che tocca dati di un utente (`Where(x => x.OwnerId == currentUser.UserId)`), così l'endpoint non contiene controlli di proprietà e non si può dimenticare chiamandolo da un altro punto. Il tenant si applica con il global query filter (§4.4) alimentato da `ICurrentUser`; il filtro per proprietario di un'entità è un metodo di estensione riusabile (§2c).
- **Risorsa altrui = non trovata (default):** una risorsa che esiste ma non appartiene all'utente produce `ItemNotFound` (404), non 403, per non rivelarne l'esistenza (§4.1). Il 403 resta per le azioni vietate su risorse visibili. Un progetto può derogare con il 403 (es. applicazioni interne dove la UX conta più dell'anti-enumerazione) solo annotandolo nel `CLAUDE.md`; i test di §4.6 si adeguano al codice scelto.
- **Proprietà impostate dal server:** `OwnerId`, `TenantId` e simili vengono da `ICurrentUser`, mai dal DTO di richiesta (vedi mass assignment in `security.md`).
- **Autorizzazione per risorsa (solo con permessi granulari):** se `security.md` ha portato alla scelta di permessi granulari per risorsa/azione, si usano policy con `IAuthorizationHandler` e `IAuthorizationService.AuthorizeAsync(user, resource, policy)` nel servizio; con le sole scelte "solo autenticazione", ruoli o policy su claim bastano `ICurrentUser` e il filtro. Il motivo dell'eventuale handler per risorsa va nel `CLAUDE.md`.
- **Test:** per ogni risorsa di un utente, un integration test (§4.5) che verifica che un secondo utente (e un secondo tenant) non possa leggerla, modificarla né eliminarla (404), oltre ai test di ruolo/policy.

---

## 5. Messaggistica, Cache, Eventi ed Email (moduli opzionali)
Le regole su **messaggistica (RabbitMQ), outbox, eventi di dominio e cache applicativa (FusionCache L1 preferita o memory cache nativa, L2 Redis solo se concordato)** stanno in `backend-infra.md`; quelle sull'**invio email** in `backend-email.md`. Si importano solo se il progetto usa quelle funzionalità (domande di avvio in `avvio-progetto.md`). Se una funzionalità serve e il modulo non è incluso, Claude lo segnala e propone di aggiungerlo (`avvio-progetto.md` §4); non improvvisa le regole.

---

## 5b. Esecuzione su Più Container
Poiché più container applicativi girano in parallelo, nessuno stato deve vivere nel singolo processo.
- **Job schedulati:** un `BackgroundService` che esegue lavoro "unico" (outbox, pulizie) deve usare un lock distribuito (lock su database o `FOR UPDATE SKIP LOCKED`), altrimenti gira N volte. Per Coravel e per gli hosted service con più container non c'è una regola fissa: **chiedi caso per caso** come garantire che un job unico giri una sola volta.
- **Consumer RabbitMQ:** più consumer sulla stessa coda sono voluti (competing consumers), ma idempotenti.
- **Rate limiting:** i limiti in memoria sono per container; per limiti globali precisi serve un contatore condiviso, da chiedere prima di introdurre.
- **File e sessione:** nessun file locale come stato e nessuna sessione né stato di autenticazione nella memoria del singolo processo; l'eventuale stato (refresh token, denylist di revoca) sta su database o archivio condiviso. Storage dietro astrazione (vedi §2).
- **SignalR:** con più container richiede un backplane. Redis è riservato alla cache, quindi chiedi prima di introdurne uno.
- **Data Protection:** le chiavi di ASP.NET Core Data Protection sono persistite su database o volume condiviso, comuni a tutti i container (vedi `security.md`).

---

## 6. Export, Import e Documenti
- **Export:** CSV (streaming per dataset grandi), Excel e PDF generati dal backend, con endpoint dedicato che rispetta filtri e permessi. Operazioni lunghe come job in background con notifica al termine (tipo di job, strumento e retry si chiedono secondo §2 "Lavori in background").
- **Librerie:** solo gratuite e con licenza permissiva (es. ClosedXML, PdfSharp). Evita EPPlus, iText e QuestPDF: licenze commerciali o copyleft.
- **Import:** validazione riga per riga, report degli errori per riga, dry-run prima dell'applicazione e transazione, mai import parziale silenzioso.

---

## 7. Convenzioni Database
- **Naming:** tabelle al plurale (`Products`) in PascalCase su SQL Server; `snake_case` su PostgreSQL (`UseSnakeCaseNamingConvention`). Chiavi `PK_`, esterne `FK_`, indici `IX_`.
- **Indici:** sulle chiavi esterne e su ogni colonna usata in filtri e ordinamenti frequenti; verificati con il piano di esecuzione. Niente indici speculativi.
- **Seeding:** dati di riferimento (ruoli, lingue, chiavi di traduzione base) tramite migrazione o script idempotente, mai a mano. I dati di sviluppo sono separati e non vanno in produzione.
- **Primo amministratore:** se il progetto ha utenti, l'account amministratore iniziale si crea con un comando o uno step one-shot dedicato (come le migrazioni, vedi `docker.md`), non nel seeding della migrazione e non all'avvio dell'app. Email e password iniziali arrivano da variabili d'ambiente o `secrets` di Compose, mai nel codice né nel repository; la password non viene mai scritta nei log. Lo step è idempotente (se l'amministratore esiste non fa nulla) e impone il cambio password al primo accesso. Dove il progetto usa Keycloak, l'amministratore iniziale è un'operazione dell'IdP, da documentare nel README.
- **Vincoli:** integrità nel database (not null, unique, check, FK), non solo nel codice.

---

## 8. Feature Flag, Deprecazione e Performance
- **Feature flag:** `Microsoft.FeatureManagement` (MIT), con flag a vita breve da rimuovere dopo il rilascio completo. Mai flag per la sicurezza.
- **Deprecazione API:** versione nuova affiancata alla vecchia, header `Deprecation` e `Sunset`, data di dismissione dichiarata. Mai cambiare un contratto esistente in modo incompatibile senza nuova versione.
- **Performance:** obiettivo p95 < 300 ms per letture semplici e < 1 s per scritture, salvo diversa indicazione. Misura prima di ottimizzare (OpenTelemetry, `EXPLAIN`). Per i progetti critici, test di carico con uno strumento gratuito a licenza permissiva (es. Bombardier, MIT); verifica la licenza prima di proporne altri.

---

## 9. Localizzazione, Temi e Date (lato server)
- **Dizionario:** stringhe, messaggi di errore e dizionari sono su database (Chiave-Valore-Lingua) ed esposti da un endpoint dedicato (es. `/api/localization/dictionary?lang=it`).
- **Cache:** il dizionario è cacheato lato server (con la cache concordata per il progetto, vedi `backend-infra.md`) con invalidazione alla modifica e supporto ETag/`If-None-Match`.
- **Preferenze utente:** tema e fuso orario IANA (es. `Europe/Rome`) sono salvati nel profilo e inclusi nel payload del profilo, se il progetto ha un profilo utente; altrimenti la sede si concorda (vedi `frontend.md` §4.1).
- **Date:** storage SEMPRE in UTC. In C# usa `DateTimeOffset` oppure `DateTime` con `Kind=Utc`. Su PostgreSQL `timestamp with time zone`.
