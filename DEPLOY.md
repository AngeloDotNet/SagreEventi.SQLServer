# Deploy di SagreEventi (due container + nginx sull'host)

Hostname: `myhost.mydomain.ext`

## Architettura

```
Internet --HTTPS--> nginx host (sites-available, certbot)
                      |  proxy_pass http://127.0.0.1:5417
                      v
              sagreeventi-web  (nginx-unprivileged, file statici Angular, porta 8080)
                      |  /api/  ->  http://sagreeventi-api:8080   (DNS interno di docker-net)
                      v
              sagreeventi-api  (.NET, porta 8080, NON pubblicata)
                      |
                      v
                 SQL Server
```

- Il browser parla solo con `https://myhost.mydomain.ext` (stesso dominio per sito e `/api`).
- Il nginx dell'host gestisce HTTPS e hostname, e manda tutto al container Angular.
- Il nginx **dentro** il container Angular serve i file statici (con fallback SPA) e gira `/api/` all'API tramite la rete Docker.
- L'API non ha porte pubblicate: è raggiungibile solo dentro `docker-net`.

## File coinvolti

| File | Ruolo |
|---|---|
| `.github/workflows/build-push.yml` | Build, test e push delle immagini su Docker Hub |
| `deploy/docker-compose.angular.yml` | Container `sagreeventi-web`, porta `127.0.0.1:5417` |
| `deploy/docker-compose.server.yml` | Container `sagreeventi-api`, nessuna porta pubblicata |
| `deploy/.env.example` | Modello del `.env` dell'API |
| `deploy/sites-available/myhost.mydomain.ext` | Virtual host nginx dell'host |
| `src/SagreEventi.Web/nginx.conf` | nginx del container Angular (copiato dal Dockerfile) |

La porta 5417 è casuale: se la cambi, aggiorna sia `docker-compose.angular.yml` sia il file in `sites-available`.

## Workflow GitHub (immagini su Docker Hub)

`.github/workflows/build-push.yml` compila e testa la soluzione .NET, esegue i test del client (`npm test`), poi costruisce le due immagini (sempre senza cache). Se un test fallisce l'immagine corrispondente non viene costruita né pubblicata:

- pull request verso `main`: solo build e test, nessun push;
- push su `main` o avvio manuale: push di `<utente>/sagreeventi-api` e `<utente>/sagreeventi-web` con i tag `latest` e SHA del commit.

Secret da creare nel repository (Settings → Secrets and variables → Actions):

| Secret | Contenuto |
|---|---|
| `DOCKERHUB_USERNAME` | utente Docker Hub |
| `DOCKERHUB_TOKEN` | access token Docker Hub con permesso di scrittura |

Il deploy sul server è manuale: `pull` e `up -d` dei compose (vedi sotto). Il workflow non è mai stato eseguito.

## Prerequisiti

- Docker con Compose v2 sul server.
- La rete esterna `docker-net` esiste (`docker network ls`). Se manca: `docker network create docker-net`.
- Un SQL Server raggiungibile dal container API (stesso `docker-net`, oppure host/IP raggiungibile). Utente e database devono poter essere usati dall'API (le migrazioni partono all'avvio).
- Il DNS `myhost.mydomain.ext` punta al server.
- nginx e certbot installati sull'host.
- Le immagini `<utente>/sagreeventi-api` e `<utente>/sagreeventi-web` pubblicate su Docker Hub dal workflow (vedi sotto). Se i repository sono privati: `docker login` sul server.

## Passi

### 1. Portare i file di deploy sul server

```bash
git clone <url-del-repo> /percorso/SagreEventi.SQLServer
cd /percorso/SagreEventi.SQLServer/deploy
```

Tutti i comandi seguenti vanno lanciati da `deploy/`. Per il solo deploy servono i file di questa cartella (i compose, `.env.example` e `sites-available/`): le immagini arrivano da Docker Hub.

### 2. Creare il `.env` dell'API

```bash
cp .env.example .env
nano .env
```

Da sistemare:

- `DOCKERHUB_USERNAME`: il tuo utente Docker Hub (usato dai nomi delle immagini nei compose).
- `ConnectionStrings__Default`: host del database, utente e password reali.
- `Identity__Admin__Email` e `Identity__Admin__Password`: credenziali vere dell'admin.
- `Identity__Editor__*`: valorizzali o lasciali vuoti.
- `ForwardedHeaders__KnownNetworks__0`: subnet reale di `docker-net`:

  ```bash
  docker network inspect docker-net --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}'
  ```

- `AllowedHosts` deve restare `myhost.mydomain.ext`.

Il `.env` contiene segreti: non va versionato.

### 3. Avviare l'API

```bash
docker compose -f docker-compose.server.yml pull
docker compose -f docker-compose.server.yml up -d
docker compose -f docker-compose.server.yml logs -f
```

Controlli:

- Nei log non devono esserci errori di connessione al database né di migrazione.
- Stato salute (può servire fino a ~30 s):

  ```bash
  docker ps --filter name=sagreeventi-api
  ```

  Deve comparire `healthy`. L'endpoint di controllo è `/healthz`.

### 4. Avviare Angular

```bash
docker compose -f docker-compose.angular.yml pull
docker compose -f docker-compose.angular.yml up -d
```

Controlli:

```bash
docker ps --filter name=sagreeventi-web          # deve diventare healthy
curl -I http://127.0.0.1:5417/                   # 200
curl -i http://127.0.0.1:5417/api/healthz        # vedi nota sotto
```

Nota: `/api/healthz` dipende da come l'API espone l'health check. Se risponde 404 dall'API, il proxy funziona comunque (il 404 arriva dall'API, non da nginx Angular). Un 502 indica invece che il container Angular non raggiunge `sagreeventi-api:8080` (controlla che siano entrambi su `docker-net` e che l'API sia attiva).

### 5. Configurare nginx sull'host

```bash
sudo cp sites-available/myhost.mydomain.ext /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/myhost.mydomain.ext /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Il file manda tutto a `127.0.0.1:5417` e imposta `Host`, `X-Real-IP`, `X-Forwarded-For` e `X-Forwarded-Proto`.

### 6. Certificato HTTPS con certbot

```bash
sudo certbot --nginx -d myhost.mydomain.ext
```

Certbot aggiunge il blocco 443 (con gli stessi header, quindi `X-Forwarded-Proto` diventa `https`) e il redirect da HTTP. Il rinnovo è gestito dal timer di certbot (`sudo certbot renew --dry-run` per verificarlo).

### 7. Verifica finale

- Apri `https://myhost.mydomain.ext` e controlla che il sito carichi.
- Ricarica con F5 su una rotta interna (non deve dare 404).
- Fai il login con l'admin del `.env` e verifica che le chiamate a `/api/...` rispondano (DevTools, scheda Rete).
- Verifica la PWA (vedi sotto): service worker attivo e intestazioni di `ngsw.json` e `ngsw-worker.js`.

## PWA: installazione, offline e aggiornamenti

L'app è una PWA: si può installare («Aggiungi a schermata Home» / «Installa app») e si apre anche senza rete. I dati restano gestiti dallo store locale (vedi README); il service worker mette in cache solo i file dell'app, **non** le chiamate `/api`.

Requisiti e comportamento:

- **HTTPS obbligatorio.** Service worker e installazione funzionano solo su HTTPS (o su `localhost`). In produzione è già coperto dal certificato del passo 6; su un telefono in LAN con HTTP semplice non si può provare l'installazione.
- **Il service worker è attivo solo nella build di produzione.** Con `ng serve` è spento: le pagine non ancora aperte non sono disponibili offline (l'utente vede un avviso rosso «Sei offline»).
- **`config.json`** è letto con «rete prima, cache se offline»: un cambio dell'URL dell'API si vede subito, ma l'app parte anche senza rete.
- **Fallback SPA:** ogni rotta non riconosciuta deve restituire `index.html` (già configurato in `nginx.conf`).

Cache HTTP: questi file hanno nome fisso e devono essere **sempre ricontrollati** (`Cache-Control: no-cache`), altrimenti i client non vedono mai una nuova versione:

| File | Perché |
|---|---|
| `ngsw.json` | elenco e hash dei file della versione corrente |
| `ngsw-worker.js`, `safety-worker.js`, `worker-basic.min.js` | script del service worker |
| `index.html`, `config.json` | guscio dell'app e configurazione |

`src/SagreEventi.Web/nginx.conf` lo fa già (location esatte che hanno la precedenza sulla regola a cache lunga dei file `.js`). Se metti un CDN o un altro proxy davanti, non applicare cache lunga a questi file.

Come si aggiorna una versione: dopo il `pull`/`up -d` del container Angular (vedi «Aggiornamenti successivi») i client già installati scaricano la nuova versione in background. Quando è pronta compare in alto l'icona di download e un avviso «Nuova versione disponibile»; il clic sull'icona ricarica l'app con la versione nuova. Non c'è nessun ricaricamento automatico, per non interrompere chi sta compilando un modulo.

Controlli dopo il deploy:

```bash
curl -sI https://myhost.mydomain.ext/ngsw.json        | grep -i cache-control   # no-cache
curl -sI https://myhost.mydomain.ext/ngsw-worker.js   | grep -i cache-control   # no-cache
```

In DevTools → Application: «Service Workers» deve mostrare `ngsw-worker.js` attivo e «Manifest» non deve riportare errori.

## Aggiornamenti successivi

Dopo un push su `main` il workflow pubblica le nuove immagini. Sul server, dalla cartella `deploy/` (fai `git pull` solo se sono cambiati i compose o `.env.example`):

```bash
docker compose -f docker-compose.server.yml pull && docker compose -f docker-compose.server.yml up -d      # nuova immagine API
docker compose -f docker-compose.angular.yml pull && docker compose -f docker-compose.angular.yml up -d    # nuova immagine Angular
```

I due container sono indipendenti: si aggiorna solo quello che è cambiato.

Senza Docker Hub (per esempio per una prova) i compose possono anche costruire le immagini dal repository: `docker compose -f <file> up -d --build`. In quel caso il repository deve essere clonato per intero e aggiornato con `git pull`; l'immagine costruita prende lo stesso nome `<utente>/sagreeventi-*:latest`.

## Comandi utili

```bash
docker compose -f docker-compose.server.yml logs -f
docker compose -f docker-compose.angular.yml logs -f
docker compose -f docker-compose.server.yml down
docker compose -f docker-compose.angular.yml down
docker exec sagreeventi-web nginx -t       # valida il nginx.conf nel container
```

## Problemi frequenti

| Sintomo | Causa probabile |
|---|---|
| 502 su `/api/...` | API spenta, non su `docker-net`, o nome container diverso da `sagreeventi-api` |
| 400 "Invalid Host" dall'API | `AllowedHosts` diverso dall'hostname pubblico, oppure il `Host` non viene passato |
| Redirect o cookie su `http` invece di `https` | `ForwardedHeaders__KnownNetworks__0` non contiene la subnet di `docker-net` |
| L'API non parte, errore database | Connection string errata o SQL Server non raggiungibile da `docker-net` |
| `network docker-net declared as external, but could not be found` | Rete mancante: `docker network create docker-net` |
| 404 aprendo una rotta Angular con F5 | `nginx.conf` del container non aggiornato: scarica la nuova immagine Angular (`pull`) |
| Dopo un deploy gli utenti continuano a vedere la versione vecchia | `ngsw.json` o `ngsw-worker.js` serviti con cache lunga (CDN o proxy davanti): devono avere `no-cache` |
| Il browser non propone di installare l'app | Sito non in HTTPS, service worker non attivo o manifest con errori (DevTools → Application) |
