# Test manuali

Prove che non si possono automatizzare qui (Docker non è installato sulla macchina di sviluppo). Segna `[x]` quando una prova riesce; se fallisce, annota l'errore sotto la voce e passalo a Claude.

Le prove si fanno sullo stack Docker dello step 8 (`docker-compose.yml`, `deploy/nginx`, i due Dockerfile). Gli esempi usano `SERVER_NAME=localhost` e le porte 80/443; con altre porte in `.env` (`HTTP_PORT`, `HTTPS_PORT`) cambia gli URL. `-k` serve al certificato autofirmato.

## 0. Preparazione

- [ ] `copy .env.example .env` e compilare `SERVER_NAME`, `SQL_SA_PASSWORD` (almeno 8 caratteri, maiuscole, minuscole, cifre e simboli), `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- [ ] Creare `deploy/certs/fullchain.pem` e `privkey.pem` (comando `openssl` in `.env.example`)
- [ ] `docker compose up --build` termina la build senza errori (API, web, proxy)
- [ ] `docker compose ps`: `sqlserver`, `api`, `web`, `proxy` risultano tutti `healthy`

## 1. Build e avvio

- [ ] L'API applica le migrazioni all'avvio: `docker compose logs api` non mostra eccezioni e crea ruoli e utente Admin
- [ ] Il container `api` gira con utente non root: `docker compose exec api id` → `uid` diverso da 0
- [ ] La porta 8080 dell'API non è raggiungibile dall'host: `curl http://localhost:8080/healthz` fallisce (connessione rifiutata)
- [ ] L'API non risponde a `/healthz` dall'esterno: `curl -k https://localhost/healthz` non restituisce `Healthy` (il proxy inoltra solo `/api/` e il frontend)
- [ ] `docker compose exec api bash -c 'exec 3<>/dev/tcp/localhost/8080; printf "GET /healthz HTTP/1.0\r\n\r\n" >&3; cat <&3'` → `200` e `Healthy`

## 2. HTTPS e reindirizzamento

- [ ] `curl -I http://localhost/` → `301` con `Location: https://localhost/`
- [ ] `curl -kI https://localhost/` → `200`, con `Strict-Transport-Security`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`
- [ ] Nessuna versione di nginx negli header (`Server: nginx` senza numero)
- [ ] `curl -kI https://localhost/api/Eventi/GetEventi` → `200`, con `X-Content-Type-Options: nosniff` e `Strict-Transport-Security` (inviato dall'API grazie allo schema inoltrato)
- [ ] TLS 1.0/1.1 rifiutati: `openssl s_client -connect localhost:443 -tls1_1` fallisce

## 3. Frontend

- [ ] `https://localhost/` nel browser mostra la home Angular
- [ ] Un percorso diretto (es. `https://localhost/eventi`) ricaricato con F5 non dà 404 (fallback SPA)
- [ ] `https://localhost/config.json` risponde con `apiBaseUrl` vuoto e `Cache-Control: no-store`
- [ ] I file `*.js` / `*.css` con hash hanno `Cache-Control: public, max-age=31536000, immutable`; `index.html` ha `no-cache`

## 4. Login e ruoli (stessa origine, senza CORS)

- [ ] Dal browser, login con `ADMIN_EMAIL` / `ADMIN_PASSWORD` riesce e non compaiono errori CORS in console
- [ ] `/gestione/utenti` e `/gestione/revisione` sono accessibili all'Admin
- [ ] Login con password errata → messaggio di errore, nessun dettaglio interno
- [ ] Dopo 10 login errati in un minuto dallo stesso IP → `429`
- [ ] Se `EDITOR_EMAIL`/`EDITOR_PASSWORD` sono impostati, l'Editor entra e vede solo la revisione, non la gestione utenti

## 5. Limiti e sicurezza del proxy

- [ ] **Body oltre 5 MB → 413 da nginx:**
  `curl -k -X PUT https://localhost/api/Eventi/UpdateEventi -H "Content-Type: application/json" --data-binary "@file-da-6mb.json"` → `413 Request Entity Too Large`
  (crea il file: `fsutil file createnew file-da-6mb.json 6291456` su Windows, il contenuto non conta)
- [ ] **`X-Forwarded-For` falso ignorato:** inviare più `PUT` anonimi con `-H "X-Forwarded-For: 1.2.3.4"` cambiando IP a ogni richiesta; oltre il limite per minuto (`Eventi:RichiestePutAlMinuto`) si ottiene comunque `429`, perché l'API vede sempre l'IP reale del client
- [ ] **Host sbagliato → 400:** `curl -k https://localhost/api/Eventi/GetEventi -H "Host: evil.example"` → `400` (nginx lo manda al server di default o l'API lo rifiuta con `AllowedHosts`); non deve mai restituire dati
- [ ] **Limite grossolano di nginx:** una raffica di oltre ~60 richieste in un secondo a `/api/` produce alcune risposte `429` generate da nginx
- [ ] Nessuno stack trace o messaggio di eccezione nelle risposte di errore (es. `curl -k https://localhost/api/Eventi/GetEventi?since=zzz`)

## 6. Dati e persistenza

- [ ] Segnalare un evento da anonimo: resta `In attesa` e non compare in `GetEventi`
- [ ] Da Admin, approvarlo in `/gestione/revisione`: ora compare nel catalogo
- [ ] `docker compose down` poi `docker compose up`: l'evento e l'utente Admin ci sono ancora (volume `sqldata`)
- [ ] `docker compose down -v` cancella il volume: al riavvio il database è vuoto e le migrazioni ripartono da zero

## 7. Configurazione e segreti

- [ ] `docker compose config` non mostra password nel repository: `.env` e `deploy/certs/` sono ignorati da git (`git status` non li elenca)
- [ ] Senza `ADMIN_PASSWORD` in `.env`, `docker compose up` si ferma con il messaggio «imposta ADMIN_PASSWORD nel file .env»
- [ ] `docker compose logs` non contiene password né token

## 8. Fuori da Docker (solo se si distribuisce senza container)

- [ ] `dotnet ef database update --project src/SagreEventi.Web.Server` applica le migrazioni su un SQL Server reale (in test si usa SQLite)
- [ ] Con `Database:MigraAllAvvio=false` l'API parte senza toccare lo schema
- [ ] Password reali in `appsettings.local.json` (`Identity:Admin:*`), non quelle finte di `appsettings.json`
- [ ] Con un reverse proxy diverso da quello del compose: `ForwardedHeaders:KnownProxies` o `KnownNetworks` impostati, altrimenti tutti gli utenti condividono lo stesso limite per IP

## Esito

| Data | Chi | Sezioni passate | Note |
| --- | --- | --- | --- |
|  |  |  |  |
