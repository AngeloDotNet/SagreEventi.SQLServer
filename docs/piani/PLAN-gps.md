# PLAN — Posizione degli eventi su mappa (A) e filtro «eventi vicino a me» (B)

Creato il 2026-11-01. Stato: **bozza, nessun codice toccato**. Si esegue un passo alla volta, con il «vai» esplicito dell'utente prima di ogni modifica (`CLAUDE.md`).

## Obiettivo
- **Fase A:** ogni evento può avere coordinate (latitudine/longitudine); il dettaglio mostra la posizione su mappa e un link per aprire la navigazione; chi segnala o modifica un evento può indicare il punto.
- **Fase B:** nell'elenco, un pulsante «Vicino a me» usa il GPS del dispositivo per filtrare e ordinare gli eventi per distanza.
- Resta una PWA: nessun wrapper Android/MAUI (la Geolocation API del browser basta; il tracciamento in background non è previsto).

## Assunzioni
- Le coordinate sono **facoltative**: gli eventi esistenti restano validi senza.
- La posizione dell'utente **non viene mai salvata né inviata al server né scritta nei log** (privacy/GDPR).
- Mappa: Leaflet (BSD-2-Clause, verificato il 2026-11-01) con tile OpenStreetMap e ricerca indirizzi con Nominatim, entrambi senza costi ma **senza garanzia di continuità** (vedi «Condizioni d'uso e costi»). Niente servizi a pagamento (`core.md` §3). Versione di Leaflet da verificare al primo uso.
- **Città resta invariata** (obbligatoria, come oggi). Si aggiunge **Indirizzo** (facoltativo); se manca, il punto resta generico (solo città) e il form invita a inserire l'indirizzo più preciso possibile.
- Il frontend ha già uno store locale con tutti gli eventi approvati (sincronizzazione per cursore, uso offline): la Fase B si può fare **interamente sul client**, senza endpoint nuovi.
- Date, errori e contratto restano come da `core.md` §1 (chiavi, `ProblemDetails`).

## Condizioni d'uso e costi (verificate il 2026-11-01 sulle pagine ufficiali)
Fonti: <https://operations.osmfoundation.org/policies/nominatim/>, <https://operations.osmfoundation.org/policies/tiles/>, <https://www.openstreetmap.org/copyright>, licenza di Leaflet su GitHub.
- **Costi:** nessuna delle pagine prevede pagamenti o chiavi API per Nominatim e per le tile. I dati sono ODbL (gratuiti, con attribuzione «© OpenStreetMap contributors» visibile sulla mappa). Leaflet è BSD-2-Clause.
- **Nessuna garanzia contrattuale:** sono servizi gratuiti finanziati da donazioni, «best effort», senza SLA. La Fondazione OSM può **bloccare l'accesso senza preavviso** e cambiare le regole senza avviso. Quindi non si può promettere «gratis per sempre»: si riduce il rischio con le misure sotto.
- **Nominatim (ricerca indirizzi):** massimo **1 richiesta al secondo** per l'intera app; **autocompletamento vietato** (solo ricerca su azione dell'utente); **User-Agent o Referer validi** (il browser invia già il Referer: il `Referrer-Policy` di `PLAN-security-headers.md` non deve bloccarlo); **risultati da mettere in cache** e stessa query non ripetuta; vietati scansioni sistematiche e richieste periodiche automatiche; non inviare dati personali (qui solo indirizzi di eventi pubblici).
- **Tile OSM:** solo URL `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, solo visualizzazione interattiva (le tile della vista corrente); rispettare gli header di cache HTTP (o cache di almeno 7 giorni); **vietati download in blocco, precaricamento e uso offline** (quindi **niente tile nella cache del service worker né pulsante «scarica per offline»**); attribuzione visibile in basso a destra.
- **Misure per ridurre il rischio:** (1) ricerca solo con pulsante e cache dei risultati; (2) URL delle tile e di Nominatim **configurabili a runtime** (`config.json`, come l'URL dell'API) per cambiare provider senza ripubblicare; (3) se il servizio blocca o è irraggiungibile, il form continua a funzionare: si salva senza coordinate o si tocca il punto sulla mappa; (4) piano B documentato: provider OSM alternativo gratuito (da verificare allora) o istanza propria; (5) rivedere le policy prima di ogni release.

## Possibile evoluzione futura (non in questo piano): ricerca indirizzi tramite il server
Deciso il 2026-11-01 di **non farlo ora**: la ricerca parte dal browser verso Nominatim; le coordinate confermate restano comunque salvate nel database insieme all'evento, quindi non si richiama Nominatim per mostrare un evento già salvato.
Si riconsidera, con un piano a parte, solo se:
- compaiono errori 429 (troppe richieste) o blocchi da Nominatim;
- si vuole nascondere l'IP degli utenti a OpenStreetMap;
- si vuole cambiare provider senza toccare il frontend (oggi coperto dagli URL in `config.json`).
Come sarebbe: endpoint del backend (host fisso, nessun URL fornito dal client, limite di frequenza e ALTCHA se serve) che interroga Nominatim con un `User-Agent` proprio e rispetta 1 richiesta al secondo. Cache dei risultati: FusionCache L1 in memoria (da approvare, come ogni nuova cache, `CLAUDE.md`) oppure tabella nel database (migrazione, scadenza e pulizia). Rischio da valutare: un blocco di Nominatim sull'IP del server vale per tutti gli utenti.

## Decisioni
Prese:
- **Colonne:** due `decimal(9,6)` facoltative per le coordinate (niente `geography`), deciso il 2026-11-01.
- **Indirizzo:** nuova colonna facoltativa, Città invariata; ricerca con pulsante «Trova sulla mappa» e punto confermabile o spostabile sulla mappa, deciso il 2026-11-01.
- **Filtro «vicino a me»:** lato client sullo store locale; B3 (server) chiuso, deciso il 2026-11-01.
- **Ricerca indirizzi:** chiamata diretta dal browser a Nominatim, con cache in memoria nel browser; passaggio dal server rimandato (sezione sopra), deciso il 2026-11-01.
- **CSP e intestazioni:** nessuna azione ora; le quattro regole per mappa e GPS (`img-src` tile OSM, `connect-src` Nominatim, `Permissions-Policy: geolocation=(self)`, `Referrer-Policy` diverso da `no-referrer`) sono annotate in `PLAN-security-headers.md`, deciso il 2026-11-01.
- **Chi può indicare indirizzo e coordinate:** tutti, come per gli altri campi; la moderazione controlla (chi approva vede il punto sulla mappa e può correggerlo), deciso il 2026-11-01. Nessuna restrizione per ruolo da aggiungere.
- **Branch e commit (opzione A), deciso il 2026-11-01:** i commit del GPS si fanno **dopo** quelli in sospeso di `piano-commit.md`, su un branch nuovo `feature/gps-eventi` da `develop` (nome e base da riconfermare prima del primo commit, `git.md`). Nel frattempo il lavoro resta non committato. Vincoli:
  - la migrazione `AddPosizioneEventi` va committata dopo `AddNotificaModerazione` (commit 32) e `AddStatiModerazione` (commit 42), perché ne dipende;
  - `Evento.cs`, `AppDbContext.cs`, `EfCoreEventiService.cs`, `EventoMappings.cs`, `EventoModel.cs` e lo snapshot contengono anche modifiche di altre attività: quando si committano quelle, le righe del GPS vanno escluse con patch parziali (caso per caso, su conferma, `git.md`);
  - il frontend di A2 e A3 tocca `models.ts`, `eventi-api.service`, lo store, `evento-form` ed `evento-detail`, che i commit in sospeso toccano poco (solo il commit 24 per lo spec di `evento-detail`).

Ancora aperte: **nessuna** (aggiornato il 2026-11-01). Restano solo da riconfermare, a lavoro avviato, il nome e la base del branch `feature/gps-eventi` (`git.md`).

## Fase A — posizione degli eventi

- [x] **A1 — Backend: dati e contratto** (fatto il 2026-11-01: build ok, 386 test ok; migrazione `AddPosizioneEventi` generata, non ancora applicata a un database reale; `StessoContenuto` esteso ai nuovi campi)
  - `Evento` e `EventoModel`: `Indirizzo` (`string?`, lunghezza massima da fissare), `Latitudine`, `Longitudine` (`decimal?`, `decimal(9,6)`).
  - `EventoMappings` (`ToDto`, `ToDtoPubblico` solo se `Approvato`, `ApplyFrom`).
  - `EventoValidator`: intervalli −90..90 e −180..180, entrambe o nessuna, scala massima 6 decimali; `Indirizzo` con limite di lunghezza, senza caratteri di controllo.
  - Configurazione EF in `AppDbContext` + migrazione + snapshot. Invalidazione cache già per tag `eventi`.
  - File: `Models/Entities/Evento.cs`, `SagreEventi.Shared/Models/EventoModel.cs`, `Models/Mapping/EventoMappings.cs`, `Validation/EventoValidator.cs`, `Models/Services/Infrastructure/AppDbContext.cs`, `Migrations/*`.
  - Test: unit sul validatore (limiti, solo una delle due, NaN/overflow); integration su database reale (salvataggio, lettura pubblica solo se approvato, evento senza coordinate); input malevoli (stringhe al posto di numeri, valori fuori intervallo, overposting) → 400/422, mai 500.
- [ ] **A2 — Frontend: modello e form**
  - `models.ts` (`indirizzo?`, `latitudine?`, `longitudine?`), `EventoDraft`, store locale (versione dello snapshot e migrazione dei dati salvati), `eventi-api.service`, validazione nel `evento-form`; nuovo campo Indirizzo con il suggerimento «più è preciso, più la posizione sulla mappa sarà esatta».
  - Test: spec di servizio, store e form (campi opzionali, coppia incompleta, intervalli, indirizzo troppo lungo o con caratteri di controllo).
- [ ] **A3 — Frontend: componente mappa**
  - Componente condiviso `shared/mappa` (Leaflet caricato con `@defer`/import dinamico, accessibile da tastiera, con testo alternativo e indirizzo testuale sempre presente, attribuzione OSM visibile in basso a destra), mostrato in `evento-detail`; link «Apri in Mappe/Navigazione».
  - Nel form: pulsante «Trova sulla mappa» che interroga Nominatim (una sola richiesta per azione, mai mentre si digita, risultati in cache, query identica non ripetuta, rispetto del limite di 1 richiesta al secondo), segnaposto spostabile o impostabile toccando la mappa; se la ricerca non trova nulla o fallisce (rete assente, blocco del servizio) si può comunque salvare senza coordinate.
  - URL di tile e di Nominatim in `config.json` (runtime), non nel codice. Nessuna tile nella cache del service worker (verificare `ngsw-config`/service worker esistente).
  - Dipendenza nuova da dichiarare (nome, versione, licenza) e controllo licenze/audit (`CLAUDE.md`).
  - Test: spec del componente e del servizio di ricerca (limite di frequenza, cache, errori, risposta vuota o malformata), axe sulla pagina di dettaglio, build di produzione e budget dei bundle.
- [ ] **A4 — Documentazione e sicurezza**
  - `README.md` (funzione, avviso sull'uso delle tile OSM), `CHANGELOG.md`, nota in `PLAN-security-headers.md` per CSP; `/security-review` sulle modifiche (tocca input e dati).

## Fase B — «eventi vicino a me»

- [ ] **B1 — Frontend: servizio di posizione**
  - `PosizioneService` su `navigator.geolocation` (permesso richiesto solo al tocco, timeout, errori: negato/non disponibile/timeout), funzione `distanzaKm` (Haversine) in `core/`.
  - Test: spec con `geolocation` simulata, casi di errore, coordinate invalide.
- [ ] **B2 — Frontend: filtro e ordinamento**
  - Pulsante «Vicino a me» in `eventi-list`, raggio selezionabile, distanza sulla card, ordinamento per distanza; stato vuoto e messaggio se il permesso è negato; gli eventi senza coordinate restano fuori dal filtro.
  - Test: spec del filtro, componente, E2E se esistono flussi già coperti.
- [x] **B3 — Backend: filtro per raggio — chiuso, non si fa** (deciso il 2026-11-01: il filtro «vicino a me» è solo lato client, sullo store locale; la posizione dell'utente non arriva mai al server). Si riapre solo se lo store smette di tenere tutti gli eventi sul dispositivo; in quel caso: parametri `lat`, `lon`, `raggioKm` validati e mai loggati, filtro dopo la cache (la chiave non deve dipendere dalle coordinate), test di integrazione e input malevoli.
- [ ] **B4 — Documentazione e chiusura**
  - `README.md`, `CHANGELOG.md`, informativa privacy (la posizione non lascia il dispositivo), controllo licenze e audit, `/security-review`.

## Fase C — ultimo step: valutazione di un'app nativa iOS e Android in React Native

- [ ] **C1 — Valutare un nuovo progetto React Native (solo valutazione e decisione, nessun codice)**
  - **Da fare dopo le fasi A e B**, quando il GPS e la mappa sono in uso sulla PWA e si sa cosa manca davvero.
  - **Cosa si valuta:** aggiungere al repository un secondo client, in React Native, per avere un'app nativa su iOS e Android, con l'Angular PWA che resta in parallelo (mai una sostituzione in blocco, `frontend.md` §11). Non è una «conversione»: React Native non riusa i componenti Angular né PrimeNG. Si riusano il backend e l'API così come sono, i tipi TypeScript dei modelli, la logica di dominio (filtri, distanza, date, sincronizzazione) riscritta o condivisa, i test come specifica.
  - **Esito:** un documento di valutazione (sezione in questo file o `docs/` su richiesta) con pregi, difetti, costi, rischi, alternative e una raccomandazione. Se la decisione è «sì», si scrive un `PLAN-react-native.md` separato, con proprie decisioni, regole e passi; se è «no», si annota qui il motivo e le condizioni per riaprire il tema.
  - **Prima di decidere servono:** le funzioni che la PWA non può offrire (tracciamento in background, notifiche push affidabili, widget, accesso profondo al calendario o ai contatti, presenza negli store), il budget per gli account degli store, chi mantiene il codice, quanti utenti usano già la PWA installata.

  **Pregi attesi (da verificare al momento della valutazione):**
  - interfaccia e prestazioni realmente native, un solo codice per iOS e Android;
  - TypeScript come oggi: tipi dei modelli e parte della logica si possono riusare o condividere;
  - accesso alle funzioni native: posizione in background, notifiche push, archiviazione sicura (Keychain/Keystore), calendario;
  - presenza negli store, installazione e icona come qualsiasi app;
  - tecnologia con licenza MIT (React Native; Expo, se usato) e community molto ampia;
  - aggiornamenti del solo codice JavaScript possibili senza passare dalla revisione degli store (Expo Updates o simili), entro i limiti delle policy Apple e Google.

  **Difetti attesi (da verificare al momento della valutazione):**
  - **riscrittura completa dell'interfaccia:** React e le sue librerie (navigazione, stato, form) sono uno stack nuovo accanto ad Angular; si mantengono due client per ogni funzione nuova;
  - **costi degli store:** Apple Developer Program circa 99 $/anno e Google Play circa 25 $ una tantum (importi e requisiti da verificare); per compilare e firmare per iOS serve un Mac, oppure un servizio di build in cloud (es. quello di Expo): la sua versione gratuita ha limiti ed è un servizio esterno, quindi va approvata come eccezione alla regola sui servizi cloud (`core.md` §3);
  - **mappe:** `react-native-maps` usa Google Maps su Android (chiave API e possibili costi), da escludere; l'alternativa gratuita è MapLibre (BSD-2-Clause) con tile OSM, ma restano valide le regole d'uso delle tile OSM (niente offline, niente precaricamento, `User-Agent` dichiarato) oppure serve un provider di tile con termini propri;
  - **notifiche push:** passano da FCM (Google) e APNs (Apple), servizi proprietari anche se gratuiti: eccezione da approvare;
  - **manutenzione:** aggiornamenti frequenti di React Native, dei moduli nativi e dei requisiti degli store (livello minimo di API, privacy manifest di Apple); i moduli nativi di terze parti possono restare indietro;
  - **sicurezza:** nuova superficie da coprire con il livello ASVS 2 (archiviazione dei token, pinning del certificato, deep link, protezione del codice JavaScript);
  - **regole e CI da scrivere:** `frontend.md` copre solo Angular, quindi servono regole per React Native (struttura, test con Jest/React Native Testing Library o alternative, lint), un controllo licenze npm dedicato e job di CI per Android e per iOS (runner macOS);
  - **revisione degli store:** tempi e rischio di rifiuto; Apple può contestare app con funzionalità minime;
  - **doppio impegno su stessa funzione:** ogni correzione o novità (come la mappa o il filtro «vicino a me») va fatta due volte.

  **Alternative da confrontare nella valutazione:** restare sulla sola PWA; TWA per Android (valutata a parte); Capacitor che avvolge l'Angular esistente (riuso massimo, funzioni native tramite plugin); MAUI o Flutter (altri stack, stessa riscrittura).
  - **Criterio guida:** se le funzioni native che servono sono poche, Capacitor o la sola PWA costano molto meno. React Native conviene quando l'esperienza nativa diventa un obiettivo e c'è chi lo mantiene.
  - **Decisioni da prendere in quella sede (una alla volta):** se procedere; con o senza Expo; mappa e provider di tile; gestione delle notifiche push; dove vive il codice (cartella nello stesso repository o repository a parte); come condividere i tipi dei modelli con Angular.

## Verifica a ogni passo
Build backend senza avvisi, `dotnet test`, `npm test`, `npm run lint`, `npm run build`; `dotnet list package --vulnerable --include-transitive` e `npm audit` se si aggiungono pacchetti. Solo dopo, si spunta il passo e si aggiorna `CHANGELOG.md`.

## Fuori ambito
Tracciamento in background, notifiche di prossimità, autocompletamento degli indirizzi (vietato dalla policy di Nominatim), tile offline, realizzazione di app native (MAUI, TWA, React Native: di quest'ultima in C1 si fa solo la valutazione), mappe a pagamento.
