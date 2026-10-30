<div align="center">
    
# Sagre ed eventi enogastronomici <br />

**Un posto dove tenere traccia di sagre ed eventi enogastronomici, segnalati da chi ci va.** 

[Panoramica](#panoramica) | [Funzionalità](#funzionalità) | [Architettura](#architettura) | [Per iniziare](#per-iniziare) | [Sviluppo](#sviluppo) | [Deployment](#deployment)

<img width="1000" height="420" alt="sagreeventi-devto-cover" src="https://github.com/user-attachments/assets/60d19983-03f0-4d17-ab83-32194877d1f6" /></div>

## Panoramica

SagreEventi (*sagre ed eventi enogastronomici*) è un'applicazione web per consultare, segnalare e gestire sagre ed eventi enogastronomici. Chiunque può segnalare un evento e vedere cosa c'è in programma, senza account. La modifica degli eventi esistenti è riservata agli utenti con ruolo `Admin` o `Editor`.

La soluzione ha un'API ASP.NET Core (solo API, nessuna interfaccia ospitata) e un client Angular + PrimeNG che la usa. Due container Docker (API e Angular) girano dietro il nginx dell'host. L'app **non** vende biglietti e non gestisce prenotazioni.

> [!NOTE]
> Angular è bloccato alla versione 21 di proposito: PrimeNG 21.1.x è l'ultima release di PrimeNG pubblicata con licenza MIT, mentre PrimeNG 22 introduce una chiave di licenza. Prima di aggiornare controlla le condizioni attuali di PrimeTek.

## Funzionalità

- **Consultare gli eventi:** una home con i prossimi eventi appesi a un festone, un catalogo con ricerca e un'agenda mese per mese.
- **Filtrare e ordinare:** per testo libero (senza distinzione di accenti), città e periodo (in corso, prossimi, conclusi), e per data, nome o città, in vista a griglia o a elenco.
- **Segnalare un evento:** un modulo validato con selettori di data e suggerimenti per le città. La segnalazione di un utente anonimo resta nascosta agli altri finché non è approvata; chi l'ha inviata la vede come *in attesa* sotto «Le mie» sul proprio dispositivo.
- **Revisionare le segnalazioni:** `Admin` ed `Editor` approvano o rifiutano le segnalazioni in blocco su `/gestione/revisione` e possono ritirare un evento già approvato. Gli eventi segnalati da `Admin` o `Editor` sono pubblicati subito.
- **Gestire gli utenti:** `Admin` crea, modifica (email, reset della password, ruoli) ed elimina gli utenti su `/gestione/utenti`. L'ultimo `Admin` non può essere rimosso.
- **Modificare gli eventi:** solo dopo l'accesso come `Admin` o `Editor`. Le modifiche anonime a eventi esistenti sono rifiutate dall'API (`403`).
- **Conclusione automatica:** il server conclude un evento quando la data di fine è passata. Un evento concluso non può più essere modificato da nessuno e l'API non ha la cancellazione.
- **Portarlo con sé:** aggiungi un evento al calendario (`.ics`), apri la città su una mappa, condividilo.
- **Funziona offline:** tutto ciò che vedi è salvato sul dispositivo e si sincronizza quando torna la connessione.
- **Installabile (PWA):** aggiungila alla schermata Home del telefono o installala sul desktop; l'app si apre anche senza rete e una nuova versione viene segnalata nella barra in alto.
- **Interfaccia accessibile:** interfaccia in italiano, tema chiaro e scuro, utilizzabile da tastiera e con screen reader, adattata fino al telefono.

## Architettura

| Progetto | Responsabilità |
|---|---|
| `src/SagreEventi.Shared` | Modelli condivisi (`EventoModel`, DTO di moderazione) |
| `src/SagreEventi.Web.Server` | Minimal API ASP.NET Core (.NET 10): endpoint, Identity, migrazioni EF Core, FusionCache, servizio in background che fa scadere gli eventi |
| `src/SagreEventi.Web` | Client Angular 21 (componenti standalone, signal, zoneless) con PrimeNG e un preset Aura personalizzato |
| `tests/SagreEventi.Web.Server.Tests` | Test di integrazione dell'API (xUnit, SQLite in memoria) |
| `src/SagreEventi.Web/src/app/core/*.spec.ts` | Unit test del client (Vitest, jsdom) |
| `deploy/docker-compose.yml`, `deploy/docker-compose.*.yml`, `deploy/sites-available` | Due container (Angular e API) dietro il nginx dell'host, da un compose unico o da due separati, vedi [Deployment](#deployment) e [DEPLOY.md](DEPLOY.md) |
| `.github/workflows/build-push.yml` | Compila e testa (API e client), poi pubblica le immagini API e Angular su Docker Hub (push su `main`) |

I componenti Angular tengono template, stili e classe in file separati (`x.component.ts`, `x.component.html` e `x.component.css` solo se il componente ha stili); le tre pagine di `features/eventi/` stanno ciascuna nella propria cartella.

Perché questo stack:

- **Un solo contratto, molti client:** l'API è un pugno di endpoint, quindi un nuovo client è questione di un fine settimana.
- **Offline-first:** gli eventi stanno in `localStorage` e un piccolo passo di sincronizzazione li riallinea con SQL Server.
- **Poche parti mobili nel client:** Angular, PrimeNG (tema e icone) e RxJS. Nessuna libreria di stato e nessun framework CSS.
- **Configurazione a runtime:** l'indirizzo dell'API è letto da `config.json`, quindi una sola build funziona in ogni ambiente.

### Moderazione

Gli eventi hanno tre stati: `InAttesa` (predefinito per le segnalazioni anonime), `Approvato` e `Rifiutato`. `GetEventi` restituisce solo gli eventi approvati e il server non si fida mai di uno stato inviato da un client. Un evento rifiutato viene conservato con una nota facoltativa, visibile solo ad `Admin` ed `Editor`: a chi l'ha segnalato non viene detto nulla e lo vede ancora come in attesa. Ritirare un evento approvato lo trasforma in un evento rifiutato e concluso, che i client usano per eliminare la copia locale alla sincronizzazione successiva.

### Sincronizzazione offline-first

Il client Angular tiene una propria copia degli eventi e si sincronizza con l'API in tre passi:

1. **Push:** gli eventi creati o modificati sul dispositivo sono inviati con `PUT /api/Eventi/UpdateEventi`.
2. **Pull:** le modifiche degli altri sono scaricate con `GET /api/Eventi/GetEventi?since=<cursore>`.
3. **Merge:** i dati del server sostituiscono quelli locali, a meno che la copia locale sia in attesa e più recente. Gli eventi conclusi vengono rimossi.

La sincronizzazione parte all'avvio, quando il browser torna online e quando premi il pulsante di sincronizzazione nella barra in alto.

### Progressive web app

Il client è una PWA installabile (web manifest, icone, service worker di Angular). Il service worker mette in cache solo i file dell'applicazione, **non** le chiamate `/api`: i dati restano nello store offline-first descritto sopra, così sul dispositivo c'è un'unica fonte di verità.

- **Offline:** le pagine già visitate e la struttura dell'app si aprono senza rete. Il pulsante di sincronizzazione diventa un'icona Wi-Fi barrata e un avviso rosso segnala quando una pagina mai aperta non si può caricare.
- **Aggiornamenti:** il browser scarica una nuova versione in background. Quando è pronta compare un'icona di download nella barra in alto (con un breve avviso); cliccandola l'app si ricarica. Niente si ricarica da solo, quindi un modulo in compilazione non va mai perso.
- **Solo in produzione:** il service worker è disattivato con `ng serve`. Per provarlo, servi la build di produzione (`ng build`, poi un qualsiasi server statico) su `localhost` o in HTTPS.
- **Hosting:** `ngsw.json` e `ngsw-worker.js` non vanno mai serviti con una cache HTTP lunga; vedi [DEPLOY.md](DEPLOY.md#pwa-installazione-offline-e-aggiornamenti).

| Online | Offline | Nuova versione pronta |
|---|---|---|
| <img src="docs/screenshots/pwa-online-home.png" alt="Home page, online" width="250"> | <img src="docs/screenshots/pwa-offline-home.png" alt="Home page aperta senza rete: il pulsante di sincronizzazione mostra un'icona Wi-Fi barrata" width="250"> | <img src="docs/screenshots/pwa-aggiornamento.png" alt="Icona di download nella barra in alto e avviso di nuova versione" width="250"> |

### API

| Endpoint | Metodo | Scopo |
|---|---|---|
| `/api/Eventi/GetEventi?since={datetime}` | GET | Eventi modificati dopo `since` |
| `/api/Eventi/UpdateEventi` | PUT | Inserisce nuovi eventi (anonimo, max 20 per richiesta, con limite di frequenza per IP). Aggiorna quelli esistenti solo con un token `Admin`/`Editor` |
| `/api/Eventi/GetStati?ids=...` | GET | Stato degli eventi che hai segnalato (max 50 id). Un evento rifiutato risulta `InAttesa` |
| `/api/Eventi/Revisione/*` | GET, POST | Coda di revisione, approvazione, rifiuto ed eventi conclusi; solo `Admin`/`Editor` (`Conclusi` solo `Admin`) |
| `/api/admin/utenti`, `/api/admin/ruoli` | GET, POST, PUT, DELETE | Gestione utenti, solo `Admin` |
| `/api/auth/login`, `/api/auth/refresh`, `/api/auth/me` | POST, GET | Token bearer e di refresh, utente corrente. La registrazione è disattivata |
| `/healthz` | GET | Probe di vita usato da Docker, non instradato dal proxy nginx |

Il server imposta da solo `dataOraUltimaModifica` a ogni scrittura; il valore inviato dal client serve solo a decidere quale versione sia più recente. Il documento OpenAPI è su `/openapi/v1.json` in Development.

Un evento ha questa forma (JSON, camelCase):

```json
{
  "id": "0b1e9e8e-5c0f-4a5e-8d0e-6b1a2f6c9a11",
  "nomeEvento": "Sagra della castagna",
  "cittaEvento": "Soriano nel Cimino",
  "dataInizioEvento": "2026-10-24T00:00:00",
  "dataFineEvento": "2026-10-26T00:00:00",
  "descrizioneEvento": "Caldarroste, vino novello e musica dal vivo.",
  "eventoConcluso": false,
  "dataOraUltimaModifica": "2026-10-22T18:30:00.000Z",
  "stato": "Approvato"
}
```

`stato` è solo in uscita. I campi di testo hanno lunghezze massime (id 100, nome 200, città 100, descrizione 4000); valori più lunghi ricevono `400`.

## Per iniziare

### Prerequisiti

- .NET 10 SDK
- Un'istanza di SQL Server
- Node.js `^20.19`, `^22.12` o `^24` per il client Angular
- Docker con Compose v2, solo per il deploy (vedi [DEPLOY.md](DEPLOY.md))

### Configurare l'API

Clona il progetto:

```bash
git clone https://github.com/AngeloDotNet/SagreEventi.SQLServer.git
cd SagreEventi.SQLServer
```

Metti i segreti in `src/SagreEventi.Web.Server/appsettings.local.json`. È ignorato da git e caricato dopo `appsettings.json`:

```json
{
  "ConnectionStrings": { "Default": "Data Source=...;Initial Catalog=SagreEventi;User ID=...;Password=...;Encrypt=False" },
  "Identity": {
    "Admin": { "Email": "you@example.com", "Password": "a-strong-password" },
    "Editor": { "Email": "editor@example.com", "Password": "another-strong-password" }
  }
}
```

### Eseguire in locale

Avvia l'API:

```bash
cd src/SagreEventi.Web.Server
dotnet run
```

L'API ascolta su `https://localhost:5001` e `http://localhost:5000`. All'avvio applica le migrazioni EF Core (`Database:MigraAllAvvio`, solo SQL Server), crea i ruoli `Admin` ed `Editor` e gli utenti configurati in `Identity:Admin` e `Identity:Editor`. L'auto-registrazione pubblica è disattivata.

Avvia il client Angular in un secondo terminale:

```bash
cd src/SagreEventi.Web
npm install
npm start
```

Apri `http://localhost:4200`. In sviluppo le richieste a `/api` sono inoltrate a `https://localhost:5001` (vedi `proxy.conf.json`).

> [!WARNING]
> I valori predefiniti di `appsettings.json` sono finti (`admin@sagreeventi.local`, `editor@sagreeventi.local`). Cambiali prima di qualsiasi deploy. Dopo l'aggiornamento di un database esistente ogni evento è `InAttesa`: accedi come `Admin` o `Editor`, apri `/gestione/revisione` e approva gli eventi esistenti (fino a 100 per volta).

## Sviluppo

### Build e test

```bash
dotnet test
cd src/SagreEventi.Web
npm test            # unit test del client (Vitest)
npm run build
```

I test dell'API (xUnit, SQLite in memoria) coprono eventi, moderazione, utenti, login, limiti di frequenza, header inoltrati, CORS e input malevoli. I test del client (Vitest con jsdom, `*.spec.ts` accanto ai sorgenti in `src/app/core/`) coprono gli helper puri, l'esportazione `.ics`, l'accesso e il rinnovo del token, l'interceptor HTTP, lo store offline e la sua sincronizzazione, e i client HTTP; `npm run test:coverage` stampa un rapporto di copertura (informativo, nessuna soglia). La build di produzione del client è creata in `dist/sagre-eventi-web/browser`; servila con un qualsiasi host statico che per i percorsi sconosciuti ripieghi su `index.html`.

Controlla i pacchetti NuGet per vulnerabilità note:

```bash
dotnet list package --vulnerable --include-transitive
```

### Migrazioni del database

```bash
dotnet ef database update --project src/SagreEventi.Web.Server
```

In produzione valuta di disattivare `Database:MigraAllAvvio` ed eseguire le migrazioni in modo esplicito.

### Configurazione

Le impostazioni possono essere date anche come variabili d'ambiente, con `__` come separatore (`Identity__Admin__Email`).

| Impostazione | Descrizione |
|---|---|
| `ConnectionStrings:Default` | Stringa di connessione a SQL Server |
| `Identity:Admin`, `Identity:Editor` | Email e password degli utenti creati all'avvio |
| `Identity:RegistrazionePubblica` | `true` riattiva la registrazione pubblica (disattivata di default) |
| `Database:MigraAllAvvio` | Applica le migrazioni all'avvio |
| `Eventi:MaxPerRichiesta`, `Eventi:RichiestePutAlMinuto` | Limiti di scrittura anonima: eventi per `PUT` (20) e richieste `PUT` al minuto per IP (10) |
| `Eventi:RichiesteStatiAlMinuto` | Richieste `GetStati` al minuto per IP (30) |
| `Eventi:ScadenzaIntervalloMinuti` | Minuti tra due esecuzioni della scadenza automatica (60 di default) |
| `Kestrel:Limits:MaxRequestBodySize` | Dimensione massima della richiesta (5 MB di default) |
| `Cors:Origins` | Origini ammesse del client Angular (`http://localhost:4200` di default) |
| `ForwardedHeaders:KnownProxies`, `ForwardedHeaders:KnownNetworks` | Reverse proxy fidati per `X-Forwarded-For` e `X-Forwarded-Proto`. Senza di essi gli header sono ignorati |
| `AllowedHosts` | Valori di `Host` accettati (in Docker, il nome host pubblico) |
| `apiBaseUrl` (`public/config.json`) | URL di base dell'API per il client Angular. Vuoto significa stessa origine |

L'autenticazione usa token bearer (nessun cookie). Dietro un reverse proxy i limiti di frequenza per IP richiedono `ForwardedHeaders`, altrimenti tutti gli utenti condividono un solo limite.

## Deployment

Il client Angular e l'API girano come due container e il nginx già installato sull'host li pubblica (HTTPS con certbot). Le immagini sono pubbliche su Docker Hub, quindi **non serve clonare il repository né compilare nulla**: bastano un file compose e un `.env`.

| Immagine | Contenuto |
|---|---|
| [`angelo87dock/sagreeventi-api`](https://hub.docker.com/r/angelo87dock/sagreeventi-api) | API ASP.NET Core, porta 8080 (non pubblicata) |
| [`angelo87dock/sagreeventi-web`](https://hub.docker.com/r/angelo87dock/sagreeventi-web) | Client Angular servito da nginx, porta 8080 |

Le immagini sono costruite dal workflow GitHub Actions `.github/workflows/build-push.yml` (tag `latest` e SHA del commit) e pubblicate solo per `linux/amd64`.

### Avvio rapido (compose unico)

Servono Docker con Compose v2, un SQL Server raggiungibile dall'host e una subnet privata libera. Scarica `deploy/docker-compose.yml` e `deploy/.env.example` in una cartella vuota:

```bash
curl -O https://raw.githubusercontent.com/AngeloDotNet/SagreEventi.SQLServer/main/deploy/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/AngeloDotNet/SagreEventi.SQLServer/main/deploy/.env.example
nano .env        # stringa di connessione, password Admin, AllowedHosts, subnet
docker compose pull
docker compose up -d
```

Nel `.env` imposta almeno `ConnectionStrings__Default`, `Identity__Admin__*`, `AllowedHosts` (il nome host pubblico) e `ForwardedHeaders__KnownNetworks__0`, che è anche la subnet della rete creata dal compose (`172.29.250.0/24` di default: cambiala se è in conflitto con un'altra rete dell'host). `DOCKERHUB_USERNAME` vale `angelo87dock` di default; impostalo solo per usare immagini tue.

Il compose avvia entrambi i container su una rete propria, quindi non serve una `docker-net` esterna: il container web raggiunge l'API come `sagreeventi-api:8080` tramite il DNS di Docker e parte solo quando l'API è `healthy`. Il container web ascolta su `127.0.0.1:5417` (porta da adattare); metti davanti il nginx dell'host (`deploy/sites-available/myhost.mydomain.ext`) per l'HTTPS. Aggiorna con `docker compose pull && docker compose up -d`.

### Due compose separati

Per tenere separati i due container, su una rete `docker-net` già esistente, usa i file in `deploy/`:

| File | Ruolo |
|---|---|
| `docker-compose.angular.yml` | `sagreeventi-web`: client statico su `127.0.0.1:5417` (porta da adattare) |
| `docker-compose.server.yml` | `sagreeventi-api`: nessuna porta pubblicata, raggiungibile solo dentro `docker-net`, configurato tramite `deploy/.env` (vedi `deploy/.env.example`) |

Qui `ForwardedHeaders__KnownNetworks__0` deve essere la subnet di `docker-net`. Aggiorna con `docker compose -f <file> pull && docker compose -f <file> up -d`. La procedura passo passo è in [DEPLOY.md](DEPLOY.md).

Il nginx dentro il container Angular (`src/SagreEventi.Web/nginx.conf`) serve i file statici e inoltra `/api/` a `http://sagreeventi-api:8080`, così client e API condividono un'unica origine e `apiBaseUrl` resta vuoto. Il workflow richiede i secret di repository `DOCKERHUB_USERNAME` e `DOCKERHUB_TOKEN`; le build girano senza cache.

> [!WARNING]
> Il `docker-compose.yml` unico non è ancora stato eseguito su un host Docker (sono state verificate le immagini e la loro disponibilità pubblica, non l'avvio dello stack). In produzione usa un SQL Server gestito o con backup e un archivio di segreti al posto di `.env`.

## Risorse

- [Documentazione ASP.NET Core](https://learn.microsoft.com/aspnet/core)
- [Documentazione Entity Framework Core](https://learn.microsoft.com/ef/core)
- [FusionCache](https://github.com/ZiggyCreatures/FusionCache)
- [Documentazione Angular](https://angular.dev)
- [PrimeNG](https://primeng.org)

## Contribuire

I contributi sono benvenuti. Segnala un problema o apri una pull request:

1. Fai il fork del repository
2. Crea un branch di funzionalità a partire da `develop`
3. Applica le tue modifiche
4. Apri una pull request verso `develop`

Se il progetto ti è utile, una ⭐ su GitHub aiuta altri a scoprirlo.

## Licenza

Rilasciato con licenza MIT. Vedi [LICENSE](LICENSE) per i dettagli.

<!--
Topics: `angular`, `backend`, `csharp`, `docker`, `docker-compose`, `dotnet`, `frontend`, `fusion-cache`, `sql-server`
-->