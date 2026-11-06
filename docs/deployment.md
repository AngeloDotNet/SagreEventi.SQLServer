# Deployment

[← Torna al README](../README.md)

Il client Angular e l'API girano come due container e il nginx già installato sull'host li pubblica (HTTPS con certbot). Le immagini sono pubbliche su Docker Hub, quindi **non serve clonare il repository né compilare nulla**: bastano un file compose e un `.env`.

| Immagine | Contenuto |
| --- | --- |
| [`angelo87dock/sagreeventi-api`](https://hub.docker.com/r/angelo87dock/sagreeventi-api) | API ASP.NET Core, porta 8080 (non pubblicata) |
| [`angelo87dock/sagreeventi-web`](https://hub.docker.com/r/angelo87dock/sagreeventi-web) | Client Angular servito da nginx, porta 8080 |

Le immagini sono costruite dal workflow GitHub Actions `.github/workflows/build-push.yml` (tag `latest` e SHA del commit) e pubblicate solo per `linux/amd64`.

## Avvio rapido (compose unico)

Servono Docker con Compose v2, un SQL Server raggiungibile dall'host e una subnet privata libera. Scarica `deploy/docker-compose.yml` e `deploy/.env.example` in una cartella vuota:

```bash
curl -O https://raw.githubusercontent.com/AngeloDotNet/SagreEventi.SQLServer/main/deploy/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/AngeloDotNet/SagreEventi.SQLServer/main/deploy/.env.example
nano .env        # stringa di connessione, password Admin, AllowedHosts, subnet
docker compose pull
docker compose up -d
```

Nel `.env` imposta almeno `ConnectionStrings__Default`, `Identity__Admin__*`, `AllowedHosts` (il nome host pubblico) e `ForwardedHeaders__KnownNetworks__0`, che è anche la subnet della rete creata dal compose (`172.29.250.0/24` di default: cambiala se è in conflitto con un'altra rete dell'host). `DOCKERHUB_USERNAME` vale `angelo87dock` di default; impostalo solo per usare immagini tue.

Il compose avvia entrambi i container su una rete propria, quindi non serve una `docker-net` esterna: il container web raggiunge l'API come `sagreeventi-api:8080` tramite il DNS di Docker. Il container web ascolta su `127.0.0.1:5417` (porta da adattare); metti davanti il nginx dell'host (`deploy/sites-available/myhost.mydomain.ext`) per l'HTTPS. Aggiorna con `docker compose pull && docker compose up -d`.

## Due compose separati

Per tenere separati i due container, su una rete `docker-net` già esistente, usa i file in `deploy/`:

| File | Ruolo |
| --- | --- |
| `docker-compose.angular.yml` | `sagreeventi-web`: client statico su `127.0.0.1:5417` (porta da adattare) |
| `docker-compose.server.yml` | `sagreeventi-api`: nessuna porta pubblicata, raggiungibile solo dentro `docker-net`, configurato tramite `deploy/.env` (vedi `deploy/.env.example`) |

Qui `ForwardedHeaders__KnownNetworks__0` deve essere la subnet di `docker-net`. Aggiorna con `docker compose -f <file> pull && docker compose -f <file> up -d`. La procedura passo passo è in [DEPLOY.md](../DEPLOY.md).

Il nginx dentro il container Angular (`src/SagreEventi.Web/nginx.conf`) serve i file statici e inoltra `/api/` a `http://sagreeventi-api:8080`, così client e API condividono un'unica origine e `apiBaseUrl` resta vuoto. Il workflow richiede i secret di repository `DOCKERHUB_USERNAME` e `DOCKERHUB_TOKEN`; le build girano senza cache.

> [!WARNING]
> Il `docker-compose.yml` unico non è ancora stato eseguito su un host Docker (sono state verificate le immagini e la loro disponibilità pubblica, non l'avvio dello stack). In produzione usa un SQL Server gestito o con backup e un archivio di segreti al posto di `.env`.
