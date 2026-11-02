---
paths:
  - "**/Dockerfile*"
  - "**/docker-compose*.yml"
  - "docker/**"
---

# Regole Docker e Docker Compose

> Richiede `core.md`. Il deploy avviene sempre con `Dockerfile` e `docker-compose`: questo modulo si importa in ogni progetto che viene distribuito. Estratto da `core.md` (ex §5a).

Il deploy avviene sempre con `Dockerfile` e `docker-compose`. L'host e la sua configurazione (rete, proxy, firewall, backup del server) sono gestiti dall'utente: Claude non li assume e non li configura, ma produce artefatti Docker che funzionino su qualsiasi host.

**Servizi già presenti sul server, mai nel compose (SQL Server o PostgreSQL, e nginx come reverse proxy):** il database e il reverse proxy nginx esistono già e sono configurati sul server che ospita i container. Claude **non genera** per essi servizi, immagini, volumi, file di configurazione né script nel compose o in `docker/`. Il compose contiene solo l'applicazione e gli eventuali altri servizi di supporto concordati (Redis, RabbitMQ, ecc.). L'applicazione raggiunge il database tramite la stringa di connessione da `secrets`/variabili d'ambiente (mai valori reali nel repository); host, porta e rete del database sono dati forniti dall'utente, da chiedere se mancano (non presumerli). Il README documenta solo ciò che l'app si aspetta (variabili, porta esposta, header `X-Forwarded-*`), non la configurazione di nginx. Questo vale per sviluppo e produzione e per entrambi i motori. Non riguarda l'nginx **dentro** l'immagine del frontend (web server dei file statici, vedi sotto), che resta.

## Dockerfile
- **Multi-stage:** stage di build separato da quello di runtime. Backend: immagini `mcr.microsoft.com/dotnet/sdk` e `aspnet`; frontend: build con Node e runtime con un web server leggero (nginx), servendo solo i file statici.
- **Immagine del frontend (nginx):**
  - runtime con un'immagine nginx senza privilegi (utente non root, porta non privilegiata come 8080);
  - `config.json` generato all'avvio dalle variabili d'ambiente, non incorporato nella build: l'immagine resta una sola per tutti gli ambienti (`frontend.md` §2);
  - fallback delle route a `index.html`; asset con hash nel nome con `Cache-Control` lungo e immutabile, `index.html` e `config.json` mai in cache a lungo termine;
  - gli header di sicurezza di `security.md` (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`) sono impostati da nginx, con la CSP concordata per progetto (nonce o hash, vedi `security.md`); HTTPS e HSTS dipendono dal reverse proxy dell'utente.
- **Tag espliciti e fissi** per le immagini base (mai `latest`); versioni minori aggiornate in modo consapevole. Se aggiungere anche il digest (`tag@sha256:...`) per maggiore riproducibilità si **chiede per progetto** e si annota nel `CLAUDE.md` (sezione "Note per Claude").
- **Utente non root** nel runtime, filesystem il più possibile in sola lettura, nessun segreto nell'immagine né nei layer.
- **Una sola immagine per tutti gli ambienti:** la configurazione entra a runtime tramite variabili d'ambiente o file montati, mai con build diverse.
- **`.dockerignore`** sempre presente (`bin`, `obj`, `node_modules`, `.git`, file di segreti, `.env`).
- **Cache dei layer:** copia prima i file di dipendenze (`*.csproj`, `Directory.Packages.props`, `package*.json`), poi `restore`/`npm ci`, poi il resto del codice.
- **Healthcheck** coerente con `/health/live`, definito nel **compose** (`healthcheck:`) e non nel Dockerfile, che può non averlo. Le immagini `aspnet` non includono `curl` né `wget`: il controllo usa uno strumento disponibile nell'immagine, senza aggiungere pacchetti al runtime solo per questo; quale strumento si concorda per progetto. Immagini piccole (runtime-only, niente SDK in produzione).
- **Porte:** l'app ascolta su una porta non privilegiata (es. 8080) via `ASPNETCORE_HTTP_PORTS`; HTTPS e certificati sono responsabilità dell'host/reverse proxy; per gli header `X-Forwarded-*` e i proxy fidati vedi `security.md` ("Dietro un reverse proxy").
- **Arresto graduale (vedi `core.md` §5):** l'`ENTRYPOINT` è in forma exec (`["dotnet", "App.dll"]`, non in forma shell), così il processo riceve `SIGTERM` direttamente; nel compose `stop_grace_period` è maggiore del `ShutdownTimeout` dell'host dell'app, altrimenti i job in corso vengono interrotti dal `SIGKILL`.
- **Log su stdout/stderr**, mai su file dentro il container, salvo diversa scelta esplicita concordata per il logging (vedi `core.md` §5).

## docker-compose
- **File separati per ambiente:** `docker-compose.yml` (base), `docker-compose.override.yml` (sviluppo locale, caricato automaticamente) e `docker-compose.prod.yml` (produzione). Niente duplicazione: l'override contiene solo le differenze.
- **Servizi dipendenti** (Redis, RabbitMQ; il database no, è già sul server: vedi sopra) definiti nel compose con:
  - versioni fisse dell'immagine;
  - volumi nominati per i dati persistenti (RabbitMQ, Redis);
  - Redis con autenticazione a **sola password** (`--requirepass`, senza username/ACL), letta da secret o dalla variabile `Redis__Password`; l'healthcheck si autentica con la stessa password;
  - `healthcheck` e `depends_on` con `condition: service_healthy`;
  - `restart: unless-stopped` in produzione.
- **Reti:** rete interna per i servizi di supporto; si pubblica verso l'esterno solo la porta dell'applicazione (o del reverse proxy). Redis e RabbitMQ non espongono mai porte sull'host in produzione (in sviluppo solo se serve, su `127.0.0.1`).
- **Configurazione e segreti:** variabili d'ambiente tramite `env_file` o `environment`; segreti tramite `secrets` di Compose o file esterni al repository. I `secrets` di Compose arrivano come file in `/run/secrets/` e ASP.NET Core non li legge da solo: come l'app li riceve (provider key-per-file nella configurazione, oppure variabili d'ambiente da un `env_file` fuori dal repository) si **chiede per progetto** e la scelta va nel `CLAUDE.md` (sezione "Note per Claude"). I valori dei segreti non compaiono mai in `environment:` del compose committato. Committa un `.env.example` senza valori reali; `.env` è in `.gitignore`. In `.env.example` compaiono, con valori finti, anche le variabili che sovrascrivono i segnaposto di `appsettings.json` (es. `Redis__Password`, `Jwt__Key`, `Smtp__Username`, `Smtp__Password`, vedi `backend.md` e `security.md`).
- **Hardening dei servizi dell'applicazione (compose di produzione):** `read_only: true` con `tmpfs` per le sole directory scrivibili necessarie (es. `/tmp`), `cap_drop: [ALL]` aggiungendo solo le capability necessarie e motivate, `pids_limit` impostato. Se un'opzione impedisce il funzionamento, si deroga caso per caso e lo si annota, senza rimuoverla in blocco.
- **Risorse e log:** limiti di CPU/memoria dove sensato e rotazione dei log (`logging` con `max-size` e `max-file`).
- **Migrazioni:** servizio dedicato "one-shot" (es. il bundle EF, generato con l'SDK: uno stage `migrations` nel Dockerfile oppure un artefatto della CI, si **chiede per progetto**) che termina prima dell'avvio dell'app, con `depends_on: condition: service_completed_successfully`. Mai applicate dall'app all'avvio.
- **Primo amministratore:** se il progetto ha utenti, lo step one-shot che lo crea segue le regole di `backend.md` §7 (idempotente, credenziali da `secrets`, mai nei log, non all'avvio dell'app); come viene eseguito (comando o servizio del compose) lo decide il progetto.
- **Backup del database (da valutare in ogni progetto):** il database è preesistente sul server e il suo backup potrebbe essere già gestito dall'utente. Per questo Claude **chiede a ogni progetto** se generare il servizio di backup qui sotto o se il backup è già coperto sul server, annotando la risposta nel `CLAUDE.md` (voce "Backup"); non lo genera né lo esclude per presunzione. Se va generato, il servizio si collega al database esistente con la stringa di connessione da `secrets`.
  - Servizio "one-shot" `db-backup` nel compose, eseguibile con `docker compose run --rm db-backup`, con script `ops/backup.sh` e `ops/restore.sh` committati.
  - PostgreSQL: `pg_dump -Fc`; SQL Server: `BACKUP DATABASE` tramite `sqlcmd`. File con timestamp UTC nel nome e checksum, su un volume nominato `backups` **diverso** da quello dei dati del database.
  - Retention a rotazione configurabile (`BACKUP_RETENTION_DAYS`), credenziali tramite `secrets`, nessuna password nei log.
  - La **pianificazione** (cron dell'host o del container) e la **copia fuori dall'host** sono a cura dell'utente: Claude non le configura e le cita nel README.
  - Il README contiene la procedura di ripristino e di prova del ripristino. Claude non esegue mai `restore.sh` su dati reali senza conferma.
  - PITR (pgBackRest) solo se il `CLAUDE.md` fissa un RPO di minuti: va chiesto, non introdotto da soli.
- **Repliche:** un servizio può avere più repliche solo se rispetta §5b di `backend.md` (nessuno stato locale).
- **Validazione:** prima di consegnare, `docker compose config` deve passare e l'immagine deve buildare; se possibile avvia lo stack e verifica gli healthcheck.

## Ambienti
- Ambienti tipici: sviluppo locale (compose + override) e produzione (compose + prod). Se esiste uno staging, usa lo stesso compose con variabili diverse.
- Le differenze tra ambienti stanno SOLO in variabili d'ambiente e file compose, mai nel codice o nell'immagine.
- Il processo di aggiornamento sul server (pull, up -d, rollback) è gestito dall'utente; Claude fornisce i comandi nel README se richiesto.
