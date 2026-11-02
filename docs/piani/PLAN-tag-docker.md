# PLAN — Tag fissi per le immagini base dei Dockerfile

## Obiettivo
Rispettare `docker.md` («tag espliciti e fissi per le immagini base, mai `latest`») nei due Dockerfile, che oggi usano tag di versione maggiore o mobili.

## Assunzioni
- Decisione dell'utente: fissare **solo le immagini base** nei Dockerfile.
- Le immagini dell'app nei compose di deploy (`sagreeventi-api:latest`, `sagreeventi-web:latest`) restano `:latest`, pubblicate dalla CI (`.github/workflows/build-push.yml`) e aggiornate dalla pipeline di deploy dell'utente: deroga da annotare in `CLAUDE.md`. I compose di `deploy/` non cambiano.
- Nessun digest `tag@sha256`, come già deciso.
- I tag esatti si leggono dai registri al momento dell'esecuzione (non dalla memoria) e restano nella stessa linea di versione maggiore di oggi (.NET 10, Node 22, nginx-unprivileged stabile).

## Passi
- [ ] 1. Elencare le immagini base attuali: `mcr.microsoft.com/dotnet/sdk:10.0`, `mcr.microsoft.com/dotnet/aspnet:10.0` (`src/SagreEventi.Web.Server/Dockerfile`); `node:22-alpine`, `nginxinc/nginx-unprivileged:stable-alpine` (`src/SagreEventi.Web/Dockerfile`).
- [ ] 2. Verificare sui registri i tag di patch disponibili (e, per Node, che resti compatibile con `.nvmrc` e `engines` di `package.json`, come richiesto da `frontend.md` §2) e proporli all'utente, uno per immagine, prima di modificare.
- [ ] 3. Aggiornare i due Dockerfile; build delle due immagini in locale.
- [ ] 4. Documentazione: `CLAUDE.md` (nota «Immagini Docker»: tag fissi nei Dockerfile, app `:latest` nel compose come deroga), `README.md`/`DEPLOY.md` se citano i tag, `CHANGELOG.md`.

## File coinvolti
`src/SagreEventi.Web.Server/Dockerfile`, `src/SagreEventi.Web/Dockerfile`, `CLAUDE.md`, `CHANGELOG.md`, eventualmente `README.md` e `DEPLOY.md`.

## Test previsti
Build delle immagini (`docker build`) e, se possibile, avvio con `docker compose config` valido. Nessun test applicativo.

## Decisioni aperte
- Politica di aggiornamento dei tag di patch (a mano o tramite Dependabot sui Dockerfile): da chiedere allo step 4.
