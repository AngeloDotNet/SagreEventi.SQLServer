# PLAN — Security headers (CSP, Referrer-Policy, Permissions-Policy, frame-ancestors)

## Obiettivo
Rispettare la sezione «Protezione dell'API» di `security.md`: CSP senza `unsafe-inline` né `unsafe-eval`, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` e `frame-ancestors`. Oggi l'API manda solo `nosniff` e HSTS (fuori da Development) e l'nginx del frontend solo `nosniff`; la scelta su come fare la CSP non è annotata in `CLAUDE.md`.

## Assunzioni
- Decisione dell'utente: piano dedicato (non deroga).
- Il frontend è servito come file statici da nginx (immagine unica, `config.json` a runtime): un nonce per richiesta non è possibile senza un componente che riscriva `index.html`, quindi la strada è l'**hash** degli inline noti (`security.md`: «chiede in ogni progetto» e annota la scelta in `CLAUDE.md`, sezione «Note per Claude»).
- HTTPS e HSTS dipendono dal reverse proxy dell'utente (`docker.md`); l'API ha già HSTS fuori da Development.
- Rischio principale: PrimeNG, il service worker della PWA, il Web Worker di ALTCHA e `config.json` possono violare una CSP severa. Per questo il primo passo è una verifica di fattibilità, con la decisione all'utente prima di scrivere codice.

## Passi
- [ ] 1. **Fattibilità della CSP (nessuna modifica al codice):** elenco di ciò che il frontend carica o crea (script e stili inline di `index.html`, stili iniettati da PrimeNG a runtime e se supporta il nonce o una configurazione senza inline, `worker-src` per il service worker e il Web Worker anti-bot, `connect-src` verso l'API e `config.json`, font e immagini). Verificare nella versione installata di Angular se la build può generare gli hash. Riportare all'utente una CSP candidata e i punti che richiederebbero `unsafe-inline`: se ce ne sono, **chiedere** (una domanda) come procedere.
- [ ] 2. **API:** `Referrer-Policy`, `Permissions-Policy` e `Content-Security-Policy` minima (`default-src 'none'; frame-ancestors 'none'`, adatta a risposte JSON) nel middleware di `Program.cs` accanto a `nosniff`; commenti XML in inglese.
- [ ] 3. **nginx del frontend:** gli stessi header di base più la CSP scelta al passo 1 (`add_header ... always`, ripetuti in ogni `location` che già imposta header, perché nginx non li eredita). File: `src/SagreEventi.Web/nginx.conf`.
- [ ] 4. **Test:** integration test sugli header dell'API (presenti su 200, 400, 401, 404 e sulla pagina di errore); per nginx una prova a vista con la build di produzione (nessun errore CSP in console con tema chiaro e scuro, PWA, offline, invio segnalazione con anti-bot) e, se possibile, un controllo automatico sul file `nginx.conf` (docker non è installato sul PC di sviluppo: la prova con `docker build` e `nginx -t` resta all'utente).
- [ ] 5. **Documentazione:** `CLAUDE.md` (nota con la scelta della CSP, righe di deroga se resta qualcosa), `README.md` e `DEPLOY.md` (header impostati da app e nginx, cosa deve fare il reverse proxy dell'utente), `CHANGELOG.md`. Security review (`/security-review`).

## Requisiti che arrivano da `PLAN-gps.md` (aggiunti il 2026-11-01)
La mappa e il GPS (Leaflet con tile OpenStreetMap, ricerca indirizzi con Nominatim, posizione del dispositivo) funzionano solo se la CSP e le altre intestazioni li lasciano passare. Da rispettare al passo 1 (fattibilità) e al passo 3 (nginx):
1. **`img-src`:** ammettere `https://tile.openstreetmap.org` (tile della mappa). Le icone dei segnaposto di Leaflet vanno servite come file dell'app, così non serve ammettere `data:`.
2. **`connect-src`:** ammettere `https://nominatim.openstreetmap.org` (ricerca degli indirizzi, solo da azione dell'utente).
3. **`Permissions-Policy`:** `geolocation=(self)`. Un valore vuoto (`geolocation=()`) blocca il GPS del filtro «vicino a me».
4. **`Referrer-Policy`:** mai `no-referrer`: Nominatim e le tile OSM richiedono un Referer valido (il browser lo invia da solo). Va bene `strict-origin-when-cross-origin`.
Nota collegata: il service worker (`ngsw-config.json`) non deve mettere in cache le tile (la policy OSM vieta l'uso offline); oggi non lo fa e non va aggiunto un gruppo dati per loro.
Se la CSP viene applicata prima del GPS, le regole 1 e 2 si aggiungono insieme al codice della mappa (passo A3 di `PLAN-gps.md`) e il test sulle intestazioni di nginx le include.

## File coinvolti
`Program.cs` (o nuovo metodo in `Extensions/`), `src/SagreEventi.Web/nginx.conf`, eventualmente `angular.json` o `index.html` (solo se il passo 1 lo richiede), `tests/SagreEventi.Web.Server.Tests/` (nuovo test sugli header; esiste già `HstsTests.cs` come modello), `README.md`, `DEPLOY.md`, `CLAUDE.md`, `CHANGELOG.md`.

## Test previsti
Integration test sugli header dell'API; verifica a vista e manuale per nginx (vedi passo 4).

## Decisioni aperte
- Esito del passo 1: se una CSP senza `unsafe-inline` è realizzabile con PrimeNG e la PWA; altrimenti deroga annotata solo per `style-src` (da chiedere).
- Coordinamento con `PLAN-tag-docker.md` (stesso Dockerfile del frontend) e con `PLAN-trace-id.md` (CORS e header di risposta nello stesso middleware).
