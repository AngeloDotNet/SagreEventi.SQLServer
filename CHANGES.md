# Registro modifiche al codice

Riassunto compatto delle modifiche fatte con Claude, così non serve rileggere i file per ricostruire il contesto.
Ordine: più recente in alto. Una voce per intervento: cosa, dove (file), perché.

## 2026-10-30 — PWA, step 5: documentazione, nginx e `PLAN-pwa.md` rimosso

**Perché:** ultimo step del piano PWA, con il via dell'utente (che ha chiesto anche di cancellare il piano a lavoro concluso).

**Cosa:** `src/SagreEventi.Web/nginx.conf`: location esatte con `Cache-Control: no-cache` per `ngsw.json`, `ngsw-worker.js`, `safety-worker.js`, `worker-basic.min.js`. Prima `ngsw-worker.js` rientrava nella regola dei `.js` con cache di un anno (`immutable`): i client non avrebbero visto le nuove versioni. `DEPLOY.md`: nuova sezione «PWA: installazione, offline e aggiornamenti» (HTTPS, solo build di produzione, file da non mettere in cache, come si aggiorna, controlli con `curl`), voce nella verifica finale, due righe nei problemi frequenti. `README.md`: punto «Installable (PWA)» nelle funzionalità e sezione «Progressive web app» con i tre screenshot di `docs/screenshots/`. Cancellato `PLAN-pwa.md` (tutti gli step conclusi; la storia resta qui).

**Note:** non ho potuto validare il `nginx.conf` con `nginx -t` (nessun nginx locale usato): la sintassi aggiunta è semplice, ma conviene un `docker exec sagreeventi-web nginx -t` dopo il prossimo deploy. Nessun commit.

## 2026-10-30 — Toast rosso quando una pagina non si può caricare (offline)

**Perché:** offline, aprire una pagina non ancora scaricata (con `ng serve`, senza service worker) non dava nessun segnale all'utente, solo l'errore in console.

**Cosa:** nuovo `core/errore-navigazione.service.ts` (+ `.spec.ts`, 3 test): ascolta `NavigationError` del router e mostra un toast `error` che resta finché l'utente non lo chiude (`sticky`): «Sei offline» se `!store.online()`, altrimenti «Pagina non caricata». Avviato da `AppComponent` (`inject` nel costruttore). Build ok, 294 test ok.

**Note:** in produzione con il service worker le pagine sono in cache, quindi il caso è raro. Resta lo step 5 (documentazione e README). Nessun commit.

## 2026-10-30 — Sync: icona wifi barrato quando l'app è offline

**Perché:** nello screenshot offline per il README non si capiva che mancasse la rete (l'icona restava `pi-sync`).

**Cosa:** `sync-status.component.html`: con `!store.online()` mostra `pi-wifi` (classe `sync-senza-rete`) al posto di `pi-sync`; `styles.css`: diagonale che barra l'icona (`::after`) e ambra più chiaro sui temi scuri (`.app-dark .sync.is-offline`). Il badge delle modifiche da inviare resta. Screenshot in `docs/screenshots/`: nuovo `pwa-online-home.png` per il confronto, `pwa-offline-home.png` rifatto con la nuova icona (nella prova l'evento `offline` è emesso a mano: l'emulazione di Puppeteer non cambia `navigator.onLine`). Build e 291 test ok.

**Note:** resta lo step 5 (documentazione e README). Nessun commit.

## 2026-10-30 — Mobile: toast e titolo sistemati, screenshot rifatti

**Perché:** i due difetti emersi nello step 4 (toast tagliati e sopra la barra in basso; titolo "Sagre & Eventi" su due righe con sync + aggiornamento). Gli screenshot per il README ora sono corretti.

**Cosa:** `src/SagreEventi.Web/src/styles.css` (dopo «Navigazione mobile»): `.brand-nome` su una riga; sotto 900px gap ridotti e `.p-toast.p-toast-bottom-right` a tutta larghezza (0.75rem ai lati) a 5rem dal fondo, sopra la barra; sotto 420px titolo un po' più piccolo. Build ok. `docs/screenshots/pwa-offline-home.png` e `pwa-aggiornamento.png` rifatti a 390px con backend finto che risponde 200 (niente toast 503).

**Note:** la voce qui sotto, sui difetti negli screenshot, è superata. Resta lo step 5 (documentazione e README). Nessun commit.

## 2026-10-30 — Screenshot della PWA salvati per il README

**Perché:** richiesta dell'utente: conservare gli screenshot della prova per integrarli nel `README.md` durante lo step 5.

**Cosa:** nuova cartella `docs/screenshots/` con `pwa-offline-home.png` (home aperta con la rete spenta) e `pwa-aggiornamento.png` (icona di aggiornamento e toast). Copie degli originali nella scratchpad; il `README.md` non è ancora stato toccato.

**Note:** in entrambi gli screenshot compaiono i due difetti emersi nello step 4 (toast tagliati a sinistra e sopra la barra in basso; titolo su due righe nello screenshot dell'aggiornamento) e un toast d'errore 503 dovuto al backend finto della prova: se si sistemano, conviene rifarli prima di pubblicarli nel README. Nessun commit.

## 2026-10-30 — PWA, step 4: prova end-to-end (nessuna modifica al codice)

**Perché:** step 4 di `PLAN-pwa.md`: verificare in un browser vero service worker, offline e aggiornamento.

**Come:** build di produzione servita da un piccolo server statico su `localhost:8080` (fallback SPA, `/api` simulato con 503, `ngsw.json`/`index.html` senza cache) e Chrome pilotato con `puppeteer-core` (viewport 390×800), tutto nella scratchpad, fuori dal repository.

**Risultati (tutti ok):** manifest collegato e app installabile secondo Chrome (nessun errore di installabilità); service worker attivo e pagina controllata; cache `ngsw:` create. Con la rete spenta: home, `/eventi` (rotta lazy), `/informazioni` si aprono; icone e `config.json` serviti dalla cache; font di PrimeIcons disponibile. Aggiornamento: con una «versione B» (index.html e `ngsw.json` modificati) l'icona `pi-download` e il toast compaiono; il clic ricarica sulla versione B e l'icona sparisce.

**Note sulla prova:** un controllo preliminare («prima dell'aggiornamento la pagina è A») è fallito, ma è un limite del test (`fetch('/')` dalla pagina riceveva già la B mentre l'aggiornamento era in corso), non dell'app. Un primo tentativo era fallito perché il profilo di Chrome era in un percorso troppo lungo (cache non apribile): problema dell'ambiente di prova.

**Problemi emersi (da decidere):** (1) su mobile (390 px) i toast escono tagliati a sinistra e coprono la barra di navigazione in basso; (2) con le icone sync e aggiornamento il titolo «Sagre & Eventi» va a capo su due righe. Non risolti, nessun commit.

## 2026-10-30 — PWA, step 3: avviso di nuova versione (`PLAN-pwa.md`)

**Perché:** richiesta dell'utente: avvisare quando il service worker ha scaricato una nuova versione, con un'icona nella topbar (non solo un toast).

**Cosa:** nuovo `core/aggiornamento-app.service.ts`: ascolta `SwUpdate.versionUpdates` (solo `VERSION_READY`, solo se il service worker è attivo), espone il signal `disponibile` e mostra un toast informativo di 8 s; `aggiorna()` attiva la versione e ricarica la pagina (anche se l'attivazione fallisce). `app.component.html`/`.ts`: icona `pi-download` (cerchio pieno nel colore principale) a destra del sync, visibile solo se `disponibile()`, con `aria-label`/`title` «Aggiornamento disponibile: clicca per aggiornare». `styles.css`: classe `.aggiornamento`. `aggiornamento-app.service.spec.ts`: 6 test (stato iniziale, versione pronta, altri eventi ignorati, service worker spento, attivazione + ricarica, ricarica anche se l'attivazione fallisce).

**Verifica:** `ng build` ok senza warning; 291/291 test verdi. Il comportamento reale con un service worker vero si prova nello step 4; l'aspetto dell'icona non l'ho visto nel browser.

**Note:** nessun controllo periodico degli aggiornamenti per un'app lasciata aperta a lungo: il service worker verifica all'avvio e a ogni navigazione. Nessun commit.

## 2026-10-30 — PWA, step 1 e 2: icone, manifest, service worker (`PLAN-pwa.md`)

**Perché:** richiesta dell'utente: rendere l'app una PWA installabile con uso offline; piano in `PLAN-pwa.md`, step 1 e 2 approvati.

**Cosa (step 1):** `public/icons/`: `icon-192.png`, `icon-512.png` (angoli arrotondati), `icon-maskable-512.png` (sfondo pieno, festone nella zona sicura), `apple-touch-icon.png` (180), generate dal `favicon.svg` con uno script usa-e-getta (`sharp`, fuori dal repo). `manifest.webmanifest`: `id`, `scope`, `orientation`, `categories`, icone SVG + PNG (any e maskable), scorciatoia «Segnala un evento» (`/eventi/nuovo`). `src/index.html`: `apple-touch-icon`, meta `mobile-web-app-capable` / `apple-mobile-web-app-*`; lo script che applica il tema prima del primo render ora conosce tutti i temi (prima solo `dark`: Halloween e Natale scuro avrebbero fatto un lampo chiaro).

**Cosa (step 2):** `@angular/service-worker@21.2.25` (dipendenza); nuovo `ngsw-config.json`: gruppo `app` in prefetch (JS, CSS, index, manifest, favicon), gruppo `assets` lazy (icone, font di PrimeIcons, immagini), `dataGroups` con `/config.json` in strategia freshness (rete prima, timeout 3 s, poi cache), `navigationUrls` che esclude `/api` e i file con estensione; `angular.json`: `serviceWorker: "ngsw-config.json"` solo nella configurazione `production`; `app.config.ts`: `provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:30000' })`. Le chiamate `/api` non passano dalla cache del service worker: i dati restano gestiti dallo store offline-first.

**Verifica:** `ng build` ok senza warning: `ngsw.json` generato con 42 file in prefetch, icone/font tra gli asset lazy; 285/285 test verdi. Non ho ancora provato il service worker in un browser (step 4).

**Da fare:** step 3 (avviso «Nuova versione disponibile»), 4 (prova end-to-end con rete spenta), 5 (documentazione e cache HTTP di `ngsw.json`). Finché manca lo step 3, dopo un deploy gli utenti vedono la nuova versione solo alla visita successiva. Nessun commit.

## 2026-10-30 — Temi Pasqua e Ferragosto

**Perché:** richiesta dell'utente: aggiungere solo Pasqua e Ferragosto (Capodanno ed Epifania scartati: si sovrapporrebbero al Natale e avrebbero finestre troppo brevi).

**Cosa:** `core/theme.service.ts`: temi `pasqua` e `ferragosto` (chiari, solo classe propria); `STAGIONI` ora è una tabella di funzioni (`periodo(da, a)` per i periodi fissi): Ferragosto 1–20 agosto, Pasqua dalla Domenica delle Palme (7 giorni prima) al lunedì dell'Angelo (1 giorno dopo); nuova funzione esportata `pasqua(anno)` (algoritmo di Meeus/Jones/Butcher). `app.component.ts`: voci «Tema Pasqua» (icona `icona-uovo`) e «Tema Ferragosto» (`icona-ombrellone`), in ordine di calendario. `styles.css`: icone SVG-maschera `.icona-uovo` (uovo con fascia a zigzag) e `.icona-ombrellone`; blocchi `html.app-pasqua` (pastelli: primario lilla `#7048b8`, giallo pulcino, verde prato) e `html.app-ferragosto` (sabbia chiara e mare: primario turchese `#0a7c8c`, corallo, giallo sole). `theme.service.spec.ts`: Pasqua calcolata per 2024-2027, confini delle finestre, test che la finestra segua la Pasqua dell'anno, classi dei due temi.

**Verifica:** `ng build` ok senza warning; 285/285 test verdi. App non aperta nel browser: palette, icone a 16 px e contrasti sono scelti a occhio, da controllare a schermo (i due temi sono visibili solo cambiando la data del dispositivo: 1–20 agosto o attorno a Pasqua).

**Note:** la Pasqua 2027 cade il 28 marzo. Nessun commit.

## 2026-10-30 — Temi Halloween e Natale solo nel loro periodo

**Perché:** richiesta dell'utente: i temi stagionali devono essere visibili solo a ridosso delle festività.

**Cosa:** `core/theme.service.ts`: tabella `STAGIONI` (Halloween 15 ottobre – 2 novembre; Natale chiaro e scuro 1 dicembre – 6 gennaio, a cavallo d'anno) e funzione esportata `inStagione(tema, oggi = new Date())`. `iniziale()`: un tema stagionale salvato ma fuori periodo non viene applicato e si ricade sulla preferenza del sistema (chiaro/scuro); un valore sconosciuto resta «chiaro». `app.component.ts`: `vociTema` mostra solo i temi per cui `inStagione` è vero. `theme.service.spec.ts`: la data è fissata con `vi.useFakeTimers({ toFake: ['Date'] })` (30 ottobre di default, 20 dicembre per i test di Natale); nuovi test sui confini delle date (11 casi) e sul ritorno alla preferenza di sistema fuori stagione.

**Verifica:** `ng build` ok senza warning; 267/267 test verdi. App non aperta nel browser.

**Note:** la disponibilità si valuta al caricamento dell'app: se resta aperta a cavallo della fine del periodo, il tema in uso non cambia finché non si ricarica. La scelta salvata non viene cancellata fuori stagione, quindi l'anno dopo il tema ricompare. Nessun commit.

## 2026-10-30 — Temi Natale definitivi e icone SVG uniformi per i temi stagionali

**Perché:** richiesta dell'utente: tenere Halloween e Natale (chiaro e scuro) e avere icone tutte simili, monocromatiche, al posto dell'emoji.

**Cosa:** `styles.css`: le classi `.icona-zucca` e `.icona-albero` usano un SVG disegnato a mano come maschera CSS (`mask` / `-webkit-mask` con data URI, `background-color: currentColor`): prendono il colore del testo come le icone PrimeIcons, anche in hover e voce attiva; sostituiscono l'emoji 🎃. Tolti i marcatori `TEMP preview` dai blocchi `html.app-natale` / `html.app-natale-scuro` (ora commenti descrittivi). `app.component.ts`: Natale chiaro e scuro usano `icona-albero` (era `pi-gift`). `theme.service.spec.ts`: Natale nei temi salvati e due test sulle classi (`app-natale` senza `app-dark`; `app-natale-scuro` con `app-dark`).

**Verifica:** `ng build` ok senza warning; 254/254 test verdi. App non aperta nel browser: da controllare che zucca e albero si leggano bene a 16 px (sono disegni semplici fatti a mano) e che i colori dei temi siano leggibili.

**Ritocco dimensioni (segnalazione dell'utente: le icone sembravano più piccole di sole e luna):** `.icona-zucca` / `.icona-albero` con `font-size: 1rem` (come `.pi`, invece di ereditare la dimensione del testo) e riquadro dell'icona da `1em` a `1.2em`. Valori a occhio, da verificare a schermo.

**Note:** le maschere CSS sono supportate dai browser moderni (con prefisso `-webkit-` dove serve). Nessun commit.

## 2026-10-30 — Tolto il tema seppia; zucca 🎃 per Halloween

**Perché:** richiesta dell'utente: la seppia somigliava troppo al Natale chiaro; usare l'emoji della zucca per Halloween.

**Cosa:** `core/theme.service.ts`: rimossi `'sepia'` da `Tema`, `TEMI`, `CLASSI_TEMA` e il signal derivato `seppia`. `app.component.ts`: tolta la voce «Tema seppia»; Halloween usa la classe `icona-zucca` al posto di `pi-star-fill`. `styles.css`: rimosso il blocco `.app-seppia`; aggiunta `.icona-zucca::before { content: '🎃' }`, così l'emoji sta nello stesso elemento delle icone PrimeIcons, nel menu e nel pulsante, con lo stesso allineamento. `theme.service.spec.ts`: test riadattati ai temi rimasti (scuro, classi per dark/halloween/light) + test che un valore salvato `sepia` torni al tema chiaro (gli utenti che l'avevano scelto).

**Verifica:** `ng build` ok senza warning; 250/250 test verdi. App non aperta nel browser.

**Note:** l'anteprima Natale (voci in `TEMI_MENU`, blocchi `TEMP preview` in `styles.css`) è ancora provvisoria. Nessun commit.

## 2026-10-30 — Tema Halloween definitivo (e anteprima Natale)

**Perché:** richiesta dell'utente: tenere Halloween; vedere un tema Natale in versione chiara e scura.

**Cosa (definitivo, Halloween):** `core/theme.service.ts`: `Tema` esteso; elenco `TEMI_SCURI` (i temi che usano le superfici scure di PrimeNG: dark, halloween, natale-scuro) e mappa `CLASSI_TEMA` (classe `app-<tema>` per ogni palette), effect generico al posto dei toggle singoli. `app.component.ts`: voce «Tema Halloween» in `TEMI_MENU` (icona `pi-star-fill`, segnaposto: PrimeIcons non ha una zucca). `styles.css`: blocco `html.app-halloween` (viola scuro, testo crema, primario arancio zucca; il prefisso `html.` serve a prevalere sulle variabili che PrimeNG inietta). `theme.service.spec.ts`: halloween nei temi salvati + test su classe `app-dark`/`app-halloween` (+1 test).

**Cosa (anteprima provvisoria, Natale):** in `ThemeService` i valori `natale` e `natale-scuro`; in `TEMI_MENU` «Tema Natale chiaro» / «Tema Natale scuro» (icona `pi-gift`); in `styles.css` due blocchi marcati `TEMP preview` (`html.app-natale`: crema, rosso e verde abete; `html.app-natale-scuro`: verde notte con primario oro). Per Natale non ci sono ancora test né voce definitiva in questa nota.

**Verifica:** `ng build` ok senza warning; test verdi. App non aperta nel browser. Nessun commit.

## 2026-10-30 — Tema seppia definitivo

**Perché:** richiesta dell'utente: rendere definitivo il tema seppia mostrato in anteprima.

**Cosa:** `core/theme.service.ts`: il servizio gestisce `Tema = 'light' | 'dark' | 'sepia'` (signal `tema`, `scuro` e `seppia` derivati); nuovo `imposta(tema)` al posto di `alterna()` (rimosso), persistenza in `localStorage` come prima (valore sconosciuto → chiaro; senza scelta salvata segue il sistema chiaro/scuro); l'effect applica `app-dark` / `app-seppia` al `<html>`. `app.component.ts`: tolto il codice di anteprima (segnale, `DOCUMENT`, `applicaSeppia`...); costante `TEMI_MENU` con le tre voci, `vociTema` e `temaCorrente` derivati da essa. `app.component.html`: icona e `aria-label` del pulsante dal tema corrente. `styles.css`: blocco `.app-seppia` (variabili `--bg`, `--card`, `--ink`, `--ink-soft`, `--line*` e due variabili PrimeNG per contenuto e campi), marcatore TEMP tolto. `core/theme.service.spec.ts` riscritto per tre temi (+2 test).

**Verifica:** `ng build` ok senza warning; 247/247 test verdi. App non aperta nel browser.

**Note:** colori fissi nel CSS che non seguono le variabili (es. arancio/rosso dello stato sync) non sono stati rivisti nel tema seppia. Nessun commit.

## 2026-10-30 — Topbar: margini tra i gruppi

**Perché:** richiesta dell'utente: più spazio tra «Segnala» e sync e tra tema e menu `⋮`, senza altri divisori per ora.

**Cosa:** `styles.css`: `.cta-desktop { margin-right: 0.5rem }` (gap totale ≈ 1rem dopo «Segnala»); nuova `.menu-azioni { margin-left: 0.25rem }` applicata al `p-button` `⋮` in `app.component.html`.

**Verifica:** `ng build` ok senza warning. App non aperta nel browser: i valori sono un primo tentativo da ritoccare a vista (il `p-menu` popup è un elemento in più nel flex e può aggiungere un gap suo). Nessun commit.

**Secondo ritocco:** `.topbar-sep` margin-inline `0.75rem 0` (era `0.6rem` per lato): il pulsante del tema ha ~0.75rem di spazio interno prima dell'icona, mentre il sync ha il bordo visibile, quindi per un'aria visivamente uguale ai due lati (≈1.25rem) il margine va tutto dal lato del sync.

**Ritocco (dopo lo screenshot dell'utente):** `.cta-desktop` margin-right 0.75rem; `.topbar-sep` margin-inline da 0.25rem a 0.6rem. Lo spazio tra tema e `⋮` era già sufficiente e non è stato toccato.

## 2026-10-30 — Tema: da pulsante con label a menu «Tema chiaro / Tema scuro»

**Perché:** richiesta dell'utente (dopo l'anteprima): scelta esplicita del tema con un menu, icona che riflette il tema attuale.

**Cosa:** `app.component.html`: il pulsante del tema ora mostra solo `pi-sun` (tema chiaro) o `pi-moon` (tema scuro) e apre un `p-menu` popup (`menuTema`). `app.component.ts`: `vociTema` (computed) con «Tema chiaro» / «Tema scuro», la voce attiva ha `styleClass` `voce-attiva`; `impostaTema()` chiama `ThemeService.alterna()` solo se il tema richiesto è diverso dall'attuale (il servizio non è cambiato). `styles.css`: rimosse le regole `.btn-tema` (label nascosta su mobile), aggiunta `.p-menu .voce-attiva .p-menu-item-label` (grassetto + colore primario).

**Verifica:** `ng build` ok senza warning; 245/245 test verdi. Nessun test per il menu; app non aperta nel browser.

**Note:** possibile evoluzione: voce «Automatico» (segue il sistema), che richiederebbe un metodo esplicito in `ThemeService`. Nessun commit.

## 2026-10-30 — Topbar: menu a tre puntini con Accedi/Esci e Informazioni

**Perché:** richiesta dell'utente: raccogliere accesso e informazioni in un menu con i testi, per una topbar più pulita. Il tema resta nella topbar.

**Cosa:** `app.component.html`: tolti il link «Accedi», il pulsante «Esci» e l'icona «Informazioni»; aggiunti un `p-button` `pi-ellipsis-v` (`ariaLabel` «Menu», `aria-haspopup`) e un `p-menu` popup (`appendTo="body"`). `app.component.ts`: `MenuModule` negli `imports` e `voci` (`computed<MenuItem[]>`): «Accedi» (`/login`) oppure «Esci (email)» (chiama `esci()`), poi «Informazioni» (`/informazioni`). `styles.css`: rimossa `.btn-icona`, ora inutilizzata. Ordine topbar: Segnala · sync | tema · menu.

**Verifica:** `ng build` ok senza warning; 245/245 test verdi. Nessun test sul menu (il progetto non ha spec per `AppComponent`); app non aperta nel browser.

**Da fare:** provare nel browser apertura/chiusura del menu, voce attiva, login/logout. Nessun commit.

## 2026-10-30 — Pulsante sync alto come le altre icone

**Perché:** richiesta dell'utente: uniformare le dimensioni nella topbar.

**Cosa:** `styles.css`: `.sync` da 2.25rem a 2.5rem (larghezza e altezza), come `.btn-icona`.

**Verifica:** `ng build` ok senza warning. App non aperta nel browser. Nessun commit.

## 2026-10-30 — Sync spostato dopo il divisorio della topbar

**Perché:** richiesta dell'utente: il sync è ora un'icona come le altre, meglio nel gruppo di strumenti.

**Cosa:** `app.component.html`: `<app-sync-status />` spostato da prima di «Segnala» a dopo il divisorio; ordine: Segnala | sync · tema · accedi/esci · informazioni.

**Ripensamento (stesso giorno):** su richiesta dell'utente il sync è stato rimesso prima del divisorio, subito dopo «Segnala»: ordine finale Segnala · sync | tema · accedi/esci · informazioni.

**Verifica:** `ng build` ok senza warning. App non aperta nel browser. Nessun commit.

## 2026-10-30 — Badge numerico sull'icona di sync

**Perché:** richiesta dell'utente: mostrare «N da inviare» senza dover aprire il tooltip.

**Cosa:** `sync-status.component.html`: `<span class="sync-badge">` (aria-hidden, il numero è già nell'`aria-label`) con `store.daInviare()`, visibile solo se > 0, «99+» oltre 99. `styles.css`: `.sync` con `position: relative`; `.sync-badge` pallino con colore primario in alto a destra.

**Verifica:** `ng build` ok senza warning. App non aperta nel browser. Nessun commit.

## 2026-10-30 — Stato sync: solo icona e toast in caso di errore

**Perché:** richiesta dell'utente: l'indicatore con testo («Aggiornato») diventa solo icona; gli errori di sincronizzazione vengono segnalati con un avviso.

**Cosa:** `shared/sync-status.component.html`: tolto il testo; `aria-label` e `title` ora «stato breve · dettaglio» (es. «Aggiornato · Ultima sincronizzazione alle 15:30»). `sync-status.component.ts`: `effect` che alla comparsa di `erroreSync` mostra un toast `error` («Sincronizzazione non riuscita» + dettaglio, 8 s) con il `MessageService` già registrato (il `p-toast` è in `app.component.html`). `styles.css`: `.sync` diventa un cerchio 2.25rem; rimossa la regola `.sync-testo`. Restano i colori: arancio offline, rosso errore.

**Verifica:** `ng build` ok senza warning; 245/245 test verdi. Nessun test per il nuovo effect; app non aperta nel browser.

**Note:** il numero di modifiche «N da inviare» si legge solo nel tooltip. Se ogni sync automatico fallisce, il toast può ripresentarsi a ogni tentativo. Nessun commit.

## 2026-10-30 — Topbar: separatore dopo «Segnala» e icona utente per «Accedi»

**Perché:** richiesta dell'utente (dopo la mia valutazione): distinguere l'azione principale dal gruppo di icone e rendere più chiara l'icona di accesso.

**Cosa:** `app.component.html`: `<span class="topbar-sep">` (`aria-hidden`) tra «Segnala» e il tema; «Accedi» usa `pi-user` invece di `pi-sign-in`. `styles.css`: `.topbar-sep` (linea verticale 1px × 1.5rem, `--line-strong`), visibile solo da 900px come «Segnala».

**Verifica:** `ng build` ok senza warning. App non aperta nel browser. Nessun commit.

## 2026-10-30 — Riordino della topbar e «Accedi» solo icona

**Perché:** richiesta dell'utente: ridurre l'ingombro e spostare «Informazioni» in fondo, dopo «Segnala».

**Cosa:** `app.component.html`, `topbar-azioni`: nuovo ordine sync · Segnala · Tema (icona + label) · Accedi/Esci · Informazioni. «Accedi» è ora solo icona (`btn-icona`, `aria-label` e `title` «Accedi»).

**Verifica:** `ng build` ok senza warning. App non aperta nel browser.

**Note:** la richiesta poteva leggersi in più modi; ho messo Informazioni all'estrema destra, dopo Accedi/Esci. Nessun commit.

## 2026-10-30 — Label sul pulsante del tema

**Perché:** richiesta dell'utente: aggiungere una label all'icona del tema.

**Cosa:** `app.component.html`: `[label]` «Tema scuro» / «Tema chiaro» (la modalità a cui si passa, coerente con l'`aria-label`) e `styleClass="btn-tema"` sul `p-button`; `styles.css`: `.btn-tema .p-button-label` nascosta sotto i 900px (resta la sola icona, per non affollare la topbar mobile) e visibile da 900px.

**Verifica:** `ng build` ok senza warning. App non aperta nel browser: da controllare che il selettore sulla label di PrimeNG agisca davvero. Nessun commit.

## 2026-10-30 — Footer tolto, «Informazioni» come icona nella topbar

**Perché:** richiesta dell'utente: il footer era ridotto a una riga e il nome app è già nella topbar.

**Cosa:** `app.component.html`: rimosso `<footer>`; in `topbar-azioni`, tra il tema e Accedi/Esci, link `pi-info-circle` a `/informazioni` (`aria-label`/`title` «Informazioni», `routerLinkActive="attivo"`). `styles.css`: rimosse le regole `.footer*`; aggiunte `.btn-icona` (2.5rem tondo) e `.btn-icona.attivo`; `main` senza i 140px riservati al footer nel `min-height` e `padding-bottom` mobile da 5rem a 6rem, perché la barra in basso non copra la fine delle pagine.

**Verifica:** `ng build` ok senza warning; 245/245 test verdi. App non aperta nel browser.

**Da fare:** controllare su mobile stretto (≤480px) che la topbar non sia affollata e che la barra in basso non copra il fondo delle pagine. Nessun commit.

## 2026-10-30 — «Informazioni»: Licenza e Codice sorgente in due blocchi

**Perché:** richiesta dell'utente: spaziare meglio la sezione e separare licenza e codice sorgente.

**Cosa:** `informazioni.component.html`: due `<section>` («Licenza» con pulsante «Leggi la licenza» → `LICENSE`; «Codice sorgente» con «Repository su GitHub»); nuovo `informazioni.component.css` (griglia `auto-fit` min 18rem, due colonne su desktop e una su mobile; ogni blocco è una card come il resto dell'app, con gap verticale); `styleUrl` aggiunto al componente.

**Verifica:** `ng build` ok senza warning. App non aperta nel browser. Nessun commit.

## 2026-10-30 — «Informazioni» a tutta larghezza

**Perché:** richiesta dell'utente: il testo non deve essere limitato a circa 2/3 dello spazio.

**Cosa:** `informazioni.component.html`: tolta `pagina-stretta` (max 760px) dal contenitore e aggiunta `larga` al paragrafo introduttivo (come in revisione e amministrazione), che toglie il limite di 60ch.

**Verifica:** `ng build` ok. App non aperta nel browser. Nessun commit.

## 2026-10-30 — Pagina «Informazioni» (licenza e GitHub)

**Perché:** richiesta dell'utente: raccogliere licenza e link a GitHub in una pagina dedicata, per topbar e footer più puliti. Nessun file di piano, su sua indicazione.

**Cosa:** nuovo `features/informazioni/informazioni.component.{ts,html}` (rotta lazy `/informazioni` in `app.routes.ts`, titolo «Informazioni · Sagre & Eventi»): descrizione dell'app, link alla licenza MIT (`blob/main/LICENSE`) e pulsante «Repository su GitHub». `app.component.html`: tolta l'icona GitHub dalla topbar; il footer ora è una riga «Sagre & Eventi · Informazioni» (il testo descrittivo è passato nella pagina); `styles.css`: rimosse `.btn-icona`, `.footer-link`, `.badge-licenza`, ormai inutilizzate.

**Verifica:** `ng build` ok senza warning; 245/245 test verdi. Nessuno spec per il nuovo componente (come per le altre pagine, che non ne hanno). App non aperta nel browser.

**Note:** la pagina non è nel menu di navigazione, solo nel footer. Nessun commit.

## 2026-10-30 — Icona GitHub spostata nella topbar

**Perché:** richiesta dell'utente: il logo GitHub, solo icona e con link, nella topbar invece che nel footer.

**Cosa:** `app.component.html`: link `pi-github` (solo icona, `aria-label`/`title` «Codice sorgente su GitHub») in `topbar-azioni`, tra il tema e Accedi/Esci; tolto dal footer, dove resta solo il badge MIT. `styles.css`: nuova classe `.btn-icona` (2.5rem tondo).

**Verifica:** `ng build` ok senza warning. App non aperta nel browser.

**Da fare:** controllare su mobile stretto (≤480px) che la topbar non sia affollata. Nessun commit.

## 2026-10-30 — Footer: icona GitHub e badge licenza MIT

**Perché:** richiesta dell'utente: sostituire la riga testuale «Open source con licenza MIT. Codice sorgente» con elementi più riconoscibili.

**Cosa:** `app.component.html`: nel footer due link affiancati, `pi-github` + «Codice sorgente» (repository) e un badge «Open source · MIT» (`pi-lock-open`, `aria-label` con testo completo) che porta a `blob/main/LICENSE` su GitHub. `styles.css`: nuove regole `.footer-link` e `.badge-licenza` (flex con wrap, badge arrotondato con bordo `--line`). Icone locali di PrimeIcons, nessuna risorsa esterna (la PWA resta offline).

**Verifica:** `LICENSE` presente alla radice del repo; classi icona presenti in `primeicons.css`; `ng build` ok senza warning. Test non rieseguiti (modifica solo di template/CSS), app non aperta nel browser.

**Note:** il link al `LICENSE` assume il ramo `main`. Nessun commit.

## 2026-10-30 — Tolti i pulsanti «Segnala un evento» dagli stati vuoti

**Perché:** richiesta dell'utente (seguito della voce sotto): con le liste vuote si vedevano ancora 2-3 pulsanti uguali (topbar, hero, stato vuoto).

**Cosa:** rimosso il pulsante dall'`<app-empty-state>` di home («Nessun evento in programma»), `eventi-list` («Ancora nessun evento») e agenda («L'agenda è vuota»); resta il testo di invito. In `eventi-list.component.ts` tolto `RouterLink` (import e array `imports`), ormai inutilizzato (warning NG8113). Restano: «Segnala» nella topbar desktop, «+» mobile, pulsante dell'hero in home.

**Verifica:** `ng build` senza warning; 245/245 test verdi. App non aperta nel browser.

**Note:** nessun commit.

## 2026-10-30 — Tolti i pulsanti «Segnala un evento» dalle intestazioni di eventi e agenda

**Perché:** richiesta dell'utente: eliminare la ridondanza con il «Segnala» sempre visibile (topbar desktop, «+» mobile). Il pulsante nella topbar è stato mantenuto.

**Cosa:** rimosso il link nell'`<header class="pagina-testa">` di `features/eventi/eventi-list/eventi-list.component.html` e `features/agenda/agenda.component.html`. Restano i pulsanti negli stati vuoti e quelli della home. `RouterLink` negli `imports` serve ancora (stato vuoto / link alle voci).

**Verifica:** `ng build` ok, nessun warning. Test non eseguiti, app non aperta nel browser.

**Da fare:** controllare a vista che l'intestazione con solo il titolo sia ben allineata (`.pagina-testa`). Nessun commit.

## 2026-10-30 — Formato `x.component.*` (correzione di `x.page.*`)

**Perché:** richiesta dell'utente: il formato giusto è `x.component.ts` / `.html` / `.css`, non `x.page.*`; piano `PLAN-rinomina-component.md` (3 step), poi eliminato a lavoro finito.

**Cosa:** in `src/SagreEventi.Web/src`: tutti i 16 componenti rinominati (11 pagine in `features/`, `shared/empty-state|evento-card|festone|sync-status`, `app`) con `.ts`/`.html`/`.css` `x.component.*`; `templateUrl`/`styleUrl` aggiornati; classi con suffisso `Component` (`AgendaPage` → `AgendaComponent`, `EmptyState` → `EmptyStateComponent`, `App` → `AppComponent`, ecc.); selettori delle 11 pagine senza `-page` (`app-agenda`; quelli di `shared/` e `app-root` invariati); import e array `imports` dei componenti, `app.routes.ts` (percorsi e nomi di classe) e `main.ts` (bootstrap) aggiornati. `README.md` (frase sulla struttura) e `COMMITS-DA-FARE.md` allineati. I file `*.spec.ts` non c'entrano e non sono cambiati.

**Verifica:** nessun residuo di `.page`, `*Page` o `-page` nei sorgenti; `ng build` produzione (AOT, `strictTemplates`) e `tsc` sui test ok; 245/245 test verdi. Confronto con la build di prima della rinomina: non più identica byte per byte, come atteso (cambiano i nomi delle classi esportate dai chunk delle rotte, i selettori e i nomi minificati). Il confronto strutturale (nomi minificati e alias neutralizzati) lascia 2 chunk su 14 con differenze nella sola riga di `import{...}` (il numero di alias `a as b` dipende dai nomi minificati): non ho potuto dimostrare l'identità completa, ma non ho trovato differenze di altro tipo. Non ho aperto l'app nel browser.

**Da fare a mano:** nel template di regole esterno le regole del frontend citano `x.page.*` e il selettore `app-<nome>-page`: vanno corrette in `x.component.*` e `app-<nome>`. Nessun commit.

## 2026-10-30 — Tolte «Project scope (v1)» e «About» dal README

**Perché:** richiesta dell'utente (dopo «What's next»).

**Cosa:** `README.md`: rimosse le sezioni «Project scope (v1)» (In scope / Out of scope) e «About». Il commento HTML con i topic del repository GitHub, che stava in fondo a «About», è rimasto in fondo al file (non visibile). Il README ora termina con Resources, Contributing e License. Nessun link interno puntava alle sezioni tolte (l'indice in cima non le citava).

**Note:** i limiti di cui parlava «Out of scope» (nessuna registrazione pubblica, nessuna cancellazione di eventi) restano descritti in Overview, Features e API. Solo documentazione. Nessun commit.

## 2026-10-30 — Tolta la sezione «What's next» dal README

**Perché:** richiesta dell'utente.

**Cosa:** `README.md`: rimossa la sezione «What's next» (5 voci) dalla parte «Project scope (v1)», che ora finisce con «Out of scope». Nessun link interno puntava alla sezione.

**Note:** solo documentazione. Nessun commit.

## 2026-10-30 — Verifica del `README.md`

**Perché:** richiesta dell'utente: controllare che il README sia aggiornato e completo.

**Cosa:** riletto per intero e confrontato con `appsettings.json`, il codice delle opzioni, i file `.csproj`/`package.json` e la struttura reale. Già coerenti: architettura, tabella dei progetti, workflow, sezione di deploy, comandi di build e test. Corretto: aggiunta la chiave `Eventi:RichiesteStatiAlMinuto` (30, limite per IP di `GetStati`, presente in `appsettings.json` e nel codice ma assente dalla tabella); «What's next» non prometteva più test della logica di sync già scritti (ora: test di pages e componenti condivisi); tra i prerequisiti Docker con Compose v2, solo per il deploy.

**Note:** solo documentazione. L'avviso «Docker non provato su un host reale» resta vero e resta. Nessun commit.

## 2026-10-30 — Allineamento di `DEPLOY.md` e `COMMITS-DA-FARE.md`

**Perché:** richiesta dell'utente: i due file dovevano riflettere lo stato attuale.

**Cosa:** `DEPLOY.md`: «Aggiornamenti successivi» usava ancora `up -d --build` (avrebbe costruito in locale ignorando le immagini scaricate), ora `pull` + `up -d`, con una nota sull'alternativa di costruire dal repository; percorso del `cp` in `sites-available/` corretto rispetto alla cartella `deploy/`; passo 1 precisa che per il deploy bastano i file di `deploy/`. `COMMITS-DA-FARE.md`: intestazione e titolo del commit 1 aggiornati, elenco di ciò che contiene (inclusi `npm audit fix` e le due correzioni di `ics.ts` e interceptor), virgola mancante sistemata.

**Note:** solo documentazione. Nessun commit.

## 2026-10-30 — Rimossi i piani completati

**Perché:** richiesta dell'utente: togliere i `.md` non più utili.

**Cosa:** eliminati `PLAN-test-frontend.md` e `PLAN-separazione-template.md` (piani completati, mai committati: non recuperabili da git). Il dettaglio resta nelle voci di questo file. Tolti da `COMMITS-DA-FARE.md` (elenco di `git status` e `git add` del commit di documentazione).

**Note:** restano `CLAUDE.md`, `CHANGES.md`, `README.md`, `DEPLOY.md` e `COMMITS-DA-FARE.md` (da cancellare dopo i commit). Nessun commit.

## 2026-10-30 — `npm audit fix` sul frontend

**Perché:** `CLAUDE.md` chiede pacchetti senza vulnerabilità note; `npm audit` segnalava 2 vulnerabilità su `undici` (1 alta, 1 moderata), portate da `@angular/build`. Scelta dell'utente: provare `npm audit fix`.

**Cosa:** solo `src/SagreEventi.Web/package-lock.json`: `undici` 7.29.1 → 7.30.1, `@angular/build` 21.2.28 → 21.2.29 (più `@angular-devkit/core` e `architect` 21.2.29). `package.json` invariato, nessuna major.

**Verifica:** `npm audit`: 0 vulnerabilità; 245/245 test, build di produzione e `tsc` sui test ok. Nessun commit.

## 2026-10-30 — Interceptor: niente token verso URL protocol-relative

**Perché:** difetto segnalato dai test (step 5 del piano test): con `apiBaseUrl` vuoto un URL `//host/...` riceveva il token Bearer. Decisione dell'utente: correggere.

**Cosa:** `src/SagreEventi.Web/src/app/core/auth.interceptor.ts`: il token si aggiunge solo se l'URL inizia con `${apiBaseUrl}/` **e non** con `//`. `auth.interceptor.spec.ts`: il test `it.fails` è diventato un normale `it`.

**Verifica:** 245/245 test verdi (nessun `expected fail`), build di produzione e `tsc` sui test ok. Nessun commit.

## 2026-10-30 — Separazione template/stili (piano `PLAN-separazione-template.md` completato) e cartelle di `features/eventi`

**Perché:** richiesta dell'utente: struttura uniforme, `.ts` / `.html` / `.css` separati per tutti i componenti con template inline.

**Fatto:** i 16 componenti (11 pages in `features/`, `app.ts`, 4 in `shared/`): `template:` → `templateUrl`, `styles:` → `styleUrl`, file `.html`/`.css` accanto al `.ts` con lo stesso nome base; solo l'indentazione di 4 spazi tolta. Estrazione con uno script fuori dal repository (verifica backslash, `${`, `<pre>`).

**Verifica:** a ogni step la build di produzione senza hash (`--output-hashing none`) è **identica byte per byte** alla baseline presa prima di iniziare (`diff -r` vuoto); 244 test verdi. Il confronto è sensibile: una modifica di prova a un template lo ha fatto fallire (ripristinata).

**Dettagli:** `.css` creato per `gestione`, `mie-segnalazioni`, `amministrazione`, `revisione` (gli unici con `styles`). In `evento-form.page` il literal conteneva `\\'` (barra rovesciata raddoppiata davanti all'apostrofo in `'Segnala l\'evento'`): nel `.html` è diventato `\'`, cioè la stessa espressione Angular; lo script converte solo `\\` in `\` e rifiuta ogni altra sequenza di escape. I due `<textarea>` (`evento-form`, `revisione`) non hanno contenuto tra i tag.

**Cartelle:** su richiesta (opzione 1) le tre pagine di `features/eventi/` sono in `eventi-list/`, `evento-detail/`, `evento-form/` (stesso nome dei file); aggiornati 14 import relativi (`../../../core|shared`) e i 4 `import()` di `app.routes.ts`. Dopo questo spostamento la build non è più identica alla baseline iniziale: cambiano i nomi dei chunk e in un chunk due nomi di variabili minificate (`v`/`g` scambiati); gli step 12-16 sono stati confrontati con la nuova baseline e sono identici.

**Note:** `README.md` (frase sulla struttura dei componenti), `COMMITS-DA-FARE.md` (commit 1 ora comprende anche la separazione e le sottocartelle). Nessun `template:`/`styles:` inline rimasto; 16 `.html` e 4 `.css`; build di produzione e 244 test verdi. Nessun commit.

## 2026-10-30 — Test frontend, step 5-8 (piano `PLAN-test-frontend.md` completato)

**Perché:** richiesta dell'utente: completare i test di `core/`, poi fermarsi.

**Cosa:** nuovi spec in `src/SagreEventi.Web/src/app/core/`: `auth.interceptor.spec.ts`, `eventi-store.service.spec.ts` (persistenza, `crea`/`aggiorna`, selettori, push a blocchi da 20, edit durante l'invio, modifiche protette, pull/`unisci`, esiti a blocchi da 50, errori senza dettagli interni, concorrenza, online/offline), `eventi-api.service.spec.ts`, `revisione.service.spec.ts`, `admin-utenti.service.spec.ts` (con `messaggioErroreApi` e id ostili codificati), `theme.service.spec.ts`. Totale con gli step 0-4: 244 test + 1 `it.fails`. `.github/workflows/build-push.yml`: il job `web` esegue `npm ci` + `npm test` (Node 22) prima di costruire l'immagine. `README.md` (Build and test, tabella Architecture), `DEPLOY.md` (sezione workflow), `COMMITS-DA-FARE.md` (commit 1 con rinomina + test; `PLAN-test-frontend.md` nel commit di documentazione).

**Problema trovato, NON corretto:** `auth.interceptor.ts` con `apiBaseUrl` vuoto accetta ogni URL che inizia per `/`, quindi un URL protocol-relative (`//host/...`) riceverebbe il token Bearer. Oggi nessun codice costruisce URL così (i servizi usano sempre `/api/...`), ma è una difesa mancante. Il test è marcato `it.fails`: passa finché il difetto c'è e diventerà rosso quando lo si corregge (allora va trasformato in `it`). Fix possibile: scartare gli URL che iniziano con `//`.

**Verifica:** 244 test verdi con `TZ` = UTC, Asia/Kolkata, America/Los_Angeles; `ng build` produzione ok; `tsc` sui test pulito; mutazioni temporanee sullo store (limite 20, `>=` nel conflitto, controllo del timestamp) rilevate dai test e poi ripristinate; copertura 100% righe (branch 99,25%). Il workflow non è stato eseguito. `models.ts` (solo tipi) non ha spec.

**Note:** nessun commit. Prossimo passo richiesto dall'utente (non iniziato): separare `.ts`, `.html` e `.css` delle pages.

## 2026-10-30 — Test frontend, step 0-4 (piano `PLAN-test-frontend.md`)

**Perché:** richiesta dell'utente: test `*.spec.ts` per la logica di `core/`; eseguiti gli step 0-4 su 8.

**Cosa:** infrastruttura: `vitest` 4, `jsdom` 27, `@vitest/coverage-v8` in `devDependencies`; target `test` (`@angular/build:unit-test`, runner vitest) in `angular.json`; nuovo `tsconfig.spec.json`; script `npm test` e `npm run test:coverage` (solo informativo); `coverage` ignorato in `.gitignore` e `.dockerignore`. Spec in `src/SagreEventi.Web/src/app/core/`: `evento-utils.spec.ts` (54), `ics.spec.ts` (15), `config.service.spec.ts`, `permessi.service.spec.ts`, `auth.service.spec.ts` (25): 119 test.
**Bug corretto:** `ics.ts`, `esc`: il `;` non veniva escapato (`'\;'` in JS è `;`), ora `'\\;'` (RFC 5545). Il test scritto prima falliva.

**Verifica:** 119/119 verdi anche con `TZ` = UTC, America/Los_Angeles, Asia/Kolkata, Pacific/Auckland; `ng build` produzione ok; `tsc` sul tsconfig dei test pulito. `npm audit`: 2 vulnerabilità (`undici`) già presenti, portate da `@angular/build`, non dai pacchetti aggiunti.

**Note:** mancano gli step 5-8 (interceptor, store, servizi HTTP, CI e documentazione); il workflow GitHub non esegue ancora `npm test`. Nessun commit.

## 2026-10-30 — Rinomina SagreEventi.Web.Angular in SagreEventi.Web

**Perché:** richiesta dell'utente.

**Cosa:** cartella `src/SagreEventi.Web.Angular` spostata in `src/SagreEventi.Web` (contenuto invariato). Riferimenti aggiornati in `.github/workflows/build-push.yml` (context), `deploy/docker-compose.angular.yml` (build), `src/SagreEventi.Web/Dockerfile` (commenti), `README.md`, `DEPLOY.md`, `COMMITS-DA-FARE.md` (ora con il commit di rinomina). Le voci storiche di questo file citano ancora il vecchio nome. Il nome del progetto Angular in `angular.json` (`sagre-eventi-web`) e il percorso `dist/sagre-eventi-web` non cambiano; la cartella non è nella soluzione `.sln`.

**Note:** nessuna build eseguita (né `ng build` né `docker build`). Da fare a mano: chiudere `ng serve`/IDE che puntano al vecchio percorso. `.github/copilot-instructions.md` cancellato dall'utente di proposito (si usa Claude, non Copilot): la cancellazione va nel commit 2 di `COMMITS-DA-FARE.md`. Nessun commit.

## 2026-10-30 — Allineamento dei file .md

**Perché:** richiesta dell'utente: documentazione coerente con workflow Docker Hub e rimozione dello stack a 4 container.

**Cosa:** `README.md`: riga del workflow nella tabella Architecture, paragrafo su immagini Docker Hub, secret e aggiornamento con `pull`/`up -d`. `DEPLOY.md`: nuova sezione «Workflow GitHub», prerequisito immagini, `DOCKERHUB_USERNAME` nel `.env`, passi con `pull` + `up -d` al posto di `--build`, aggiornamenti e tabella problemi. `COMMITS-DA-FARE.md`: riscritto in 5 commit (rimosso `docker-compose.template.yml`, aggiunti workflow e rimozioni).

**Note:** solo documentazione. Nessun commit.

## 2026-10-30 — Rimosso lo stack Docker a 4 container

**Perché:** richiesta dell'utente: con i due compose separati in `deploy/`, `docker-compose.yml` non serve più; scelta «elimina tutto ciò che diventa orfano».

**Cosa:** eliminati `docker-compose.yml`, `.env.example` (root, usato solo da quel compose) e `deploy/nginx/` (Dockerfile e template del proxy). Tolte le voci `deploy/certs/` da `.gitignore` e `.dockerignore` e i due file da `SagreEventi.sln`. `README.md`: tolta la riga `deploy/nginx`, la riga `docker-compose.template.yml` (file inesistente) e la sezione dello stack a 4 container (variabili `.env`, certificato); «Deployment» ora descrive solo i due container e il workflow Docker Hub. Commento in `src/SagreEventi.Web.Angular/Dockerfile` aggiornato.

**Note:** perse le modifiche locali non committate a `docker-compose.yml` (sqlserver commentato, subnet 172.18.0.0/24); il file resta in git. Non c'è più uno stack locale con SQL Server in Docker. `DEPLOY.md` descrive ancora `up --build` invece di `pull`. Nessuna build eseguita, nessun commit.

## 2026-10-30 — Workflow GitHub Actions: build e push su Docker Hub

**Perché:** richiesta dell'utente: build delle immagini API e Angular da GitHub e pubblicazione sul suo Docker Hub (deploy sul server a mano).

**Cosa:** nuovo `.github/workflows/build-push.yml`: job `api` (build + test .NET 10, poi immagine) e `web` (immagine Angular). Su PR solo build; su push a `main` (o manuale) push di `<user>/sagreeventi-api|web` con tag `latest` e SHA. `deploy/docker-compose.server.yml` e `docker-compose.angular.yml`: aggiunto `image: ${DOCKERHUB_USERNAME}/...:latest` accanto a `build:`. `deploy/.env.example`: variabile `DOCKERHUB_USERNAME`.

**Note:** build Docker senza cache (`no-cache: true`, nessuna cache GHA). Workflow non eseguito. Secret del repo: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` (access token Docker Hub con permesso di scrittura). Sul server: `DOCKERHUB_USERNAME` in `deploy/.env`, poi `docker compose -f ... pull && up -d` (`docker login` se i repository sono privati). Nessun commit.

## 2026-10-30 — Deploy con due container dietro nginx dell'host

**Perché:** richiesta dell'utente: deploy separato di Angular e API partendo dal template compose esistente, con nginx dell'host e certbot, API non esposta.

**Cosa:** nuovi `deploy/docker-compose.template.yml` (template originale), `deploy/docker-compose.angular.yml` (`127.0.0.1:5417:8080`), `deploy/docker-compose.server.yml` (context = root repo, `env_file: .env`, nessuna porta), `deploy/.env.example` (sezioni Angular e API), `deploy/sites-available/myhost.mydomain.ext` (virtual host dell'host), `DEPLOY.md` (procedura). `src/SagreEventi.Web.Angular/nginx.conf`: aggiunti `map` su `X-Forwarded-Proto` e `location ^~ /api/` verso `sagreeventi-api:8080` (resolver Docker `127.0.0.11`). `README.md`: sezione di deploy a due container e righe nella tabella Architecture.

**Note:** nulla provato su un host Docker reale, nessuna build eseguita. Le porte 5417 (Angular) e 5738 (API, poi tolta) erano casuali. Tolti i rimandi a `TEST-MANUALI.md` e `SOSPESI.md` (file già cancellati a fine sviluppo) da `README.md` e `SagreEventi.sln`. Nessun file inutile trovato da eliminare. Nessun commit.

## 2026-10-25 — Commit del lavoro e rimozione dei file di piano

**Perché:** richiesta dell'utente: committare in più commit per area (push e PR a cura dell'utente) e togliere i piani, ormai completati.

**Cosa:** 8 commit su `main`: rimozione Blazor, OpenAPI nativo, entità e moderazione, Identity, endpoint Minimal API, Docker, documentazione, rimozione dei piani. Eliminati `PLAN-migrazione-backend.md` e `PLAN-moderazione-eventi.md`; tolti i riferimenti da `SagreEventi.sln`, `README.md` (struttura) e `SOSPESI.md`. Il dettaglio dei piani resta in questo file e in git (commit `55e9cea` e precedenti).

**Note:** i commit intermedi probabilmente non compilano da soli (codice intrecciato); lo stato finale sì. `CLAUDE.md` chiede ancora di salvare i piani in `PLAN-<nome>.md`: la regola vale per i piani futuri. Nessun push.

## 2026-10-25 — Nuovo SOSPESI.md

**Perché:** richiesta dell'utente: salvare in un file dedicato ciò che resta sospeso dopo i piani.

**Cosa:** `SOSPESI.md` (prove manuali Docker/browser/SQL Server, azioni di configurazione e dati, limiti noti); aggiunto ai Solution Items di `SagreEventi.sln`. Solo documentazione.

## 2026-10-25 — README allineato allo stato attuale

**Perché:** richiesta dell'utente. Il README era già quasi allineato; mancavano esempio JSON e struttura.

**Cosa:** `README.md`: esempio JSON con `stato` (solo output) e limiti di lunghezza dei campi; «Project structure» con `Endpoints/`, `Extensions/`, `HostedServices/`, `Migrations/`, `PLAN-*.md`, `TEST-MANUALI.md`, `CHANGES.md`, feature `segnalazioni` e `gestione`.

**Note:** solo documentazione, nessun codice toccato.

## 2026-10-23 — Revisione eventi: scheda «Conclusi» solo per l'Admin

**Perché:** richiesta dell'utente: oltre a In attesa, Rifiutati e Approvati, l'Admin deve poter vedere anche gli eventi conclusi/scaduti.

**Cosa:** nuovo `GET /api/Eventi/Revisione/Conclusi` (`RevisioneEndpoints`, policy `SoloAdmin` oltre a quella del gruppo; Editor → 403, anonimo → 401): tutti gli eventi con `EventoConcluso` in qualunque stato (scaduti e ritirati), con nota di rifiuto, per data di fine decrescente, massimo 200. `IEventiService.GetConclusiAsync` + `EfCoreEventiService`. Angular: `RevisioneService.conclusi()`; `revisione.page.ts` mostra la scheda «Conclusi» solo se `eAdmin()`, in sola lettura (niente checkbox né azioni), con colonne Stato e Nota. Nessuna modifica al modello EF. Test: 2 nuovi in `EventiApiTests` (accesso solo Admin; contenuto in ogni stato, aperti esclusi). `README.md`: riga endpoint e frase nella sezione Moderation.

**Note:** 154/154 test, `ng build --configuration production` ok. La build della soluzione intera non è stata rifatta perché l'API era in esecuzione (file `.exe` bloccato): test eseguiti con `-p:UseAppHost=false`. Riavviare l'API per vedere la scheda. Non toccati `appsettings*.json`.

## 2026-10-23 — Documentazione (README) e test manuali

**Perché:** ultimo step del piano; il README descriveva ancora l'avvio senza Docker e non citava proxy, header inoltrati, `/healthz` e test.

**Cosa:** `README.md`: sezione «Tests» (`dotnet test`, controllo pacchetti vulnerabili), sezione «Docker» (4 servizi, `.env`, certificato, `docker compose up --build`, variabili, sicurezza del proxy, avviso «non ancora provato»), tabella configurazione con `ForwardedHeaders:*`, `AllowedHosts`, `Cors:Origins` (voci vuote ignorate) e variabili d'ambiente con `__`, riga `/healthz` negli endpoint, struttura del progetto con `deploy/`, `tests/`, compose, voci «scope» e «What's next» aggiornate. Nuovo `TEST-MANUALI.md`: checklist delle prove da fare a mano (preparazione, build, HTTPS, frontend, login, limiti nginx 413/XFF/host, persistenza, segreti, deploy senza Docker). `SagreEventi.sln`: `TEST-MANUALI.md` nei Solution Items.

**Note:** solo documentazione, nessun codice toccato. **Piano completato (step 0-9).** Resta da fare a mano `TEST-MANUALI.md`.

## 2026-10-23 — Docker con nginx dedicato (file scritti, immagini non provate)

**Perché:** deploy in Docker con nginx come reverse proxy in un container dedicato, stessa origine (decisione presa con S4).

**Cosa:** 4 servizi in `docker-compose.yml`: `sqlserver` (volume, healthcheck), `api` (porta 8080 solo `expose`, migrazioni all'avvio, seed Admin da `.env`, `AllowedHosts=SERVER_NAME`, `ForwardedHeaders__KnownNetworks__0` = subnet fissa 172.28.0.0/24 della rete `interna`), `web` (Angular + `nginxinc/nginx-unprivileged`, fallback SPA, cache dei file con hash), `proxy` (`deploy/nginx`: HTTPS TLS1.2/1.3 con certificati montati da `deploy/certs`, 80→301 a HTTPS, `/api/`→`api:8080`, `/`→`web:8080`, `client_max_body_size 5m`, `X-Forwarded-For $remote_addr` (non `$proxy_add_x_forwarded_for`: il valore del client non passa mai), HSTS e header di sicurezza, `limit_req` grossolano). Dockerfile API: multi-stage sdk→aspnet, utente non root, healthcheck solo con bash su `/healthz`. Codice: `AddHealthChecks` + `MapHealthChecks("/healthz")`; CORS ignora le origini vuote (in Docker `Cors__Origins__0=""` azzera l'origine di esempio) e le legge in modo pigro. `.gitignore`: `deploy/certs/`, `.env`. Test nuovi: `HealthTests`, `CorsTests` (3).

**Note:** build 0 errori e 0 avvisi, 152/152 test, `ng build --configuration production` e `dotnet publish` ok. **Docker non è installato qui: immagini, compose e nginx.conf NON sono stati costruiti né provati** (sintassi scritta a mano). Da fare a mano: certificato (vedi `.env.example`), `.env`, `docker compose up --build`, poi le prove nel piano (413 oltre 5 MB, XFF falso, host errato). Prossimo: 9 (README).

## 2026-10-23 — Nullable reference types abilitati

**Perché:** regola di `CLAUDE.md` ("Nullable reference types abilitati"); `Shared` e `Web.Server` avevano `<Nullable>disable</Nullable>`.

**Cosa:** `<Nullable>enable</Nullable>` in `SagreEventi.Shared.csproj` e `SagreEventi.Web.Server.csproj`. Annotazioni oneste: `string?` per `MotivoRifiuto` (DTO ed entità), `RevisionatoDa`, `RifiutaEventiRequest.Motivo`, `motivo` di `IEventiService.RifiutaAsync`/`EfCoreEventiService`, `ids` di `GetStati`, campi dei body admin (`CreaUtenteRequest`/`ModificaUtenteRequest`, `Valida`) e `ValidaIds`; `= string.Empty` per le stringhe sempre valorizzate (`Id`, `NomeEvento`, `CittaEvento`, `DescrizioneEvento`, `StatoEventoModel.Id`), `= new()` in `FusionCacheOptions`. Tolti i `?.` ridondanti sul body non nullable negli endpoint admin e revisione. Test: corretti i 4 avvisi preesistenti in `AdminUtentiTests`; `SicurezzaInputTests` ha 11 casi nuovi (body senza campi o con `null` → 400, evento con testi `null` → 400) e il token Admin è ottenuto una volta per factory (limite di 10 login/minuto).

**Verifica:** `dotnet ef migrations has-pending-model-changes` prima e dopo: nessuna modifica al modello, nessuna nuova migrazione. Contratto JSON invariato.

**Note:** build 0 errori e 0 avvisi, 148/148 test. Prossimo: 8 (Docker con nginx), poi 9.

## 2026-10-23 — Test con input malevoli, escape JSON e nosniff (chiude lo step 7-sec)

**Perché:** ultimo punto della verifica sicurezza di CLAUDE.md: provare l'API con input ostili e non solo con quelli attesi.

**Cosa:** nuovo `SicurezzaInputTests` (17 casi): SQL injection (campi evento, id, `GetStati`, `since`, login, revisione, id utente), payload `<script>` solo come dato JSON, body malformati / `[null]` / data non valida → 400 senza stack trace né nomi interni, email con newline o malformata rifiutata, id utente con path traversal → 404. Il test sullo script ha trovato che le risposte JSON non escapavano `<`/`>`: `ServiceCollectionExtensions` imposta `JsonOptions.Encoder = JavaScriptEncoder.Default` (escape; per i client JSON nulla cambia) e `Program.cs` aggiunge `X-Content-Type-Options: nosniff` a tutte le risposte. Piano: 7-sec completato.

**Note:** build 0 errori, 138/138 test. Non coperto dai test: limite del corpo di 5 MB (Kestrel, non simulabile con il test server). Prossimo: 7-quater (nullable), poi 8 (Docker, con nginx) e 9.

## 2026-10-23 — Politica password, id di GetStati, AllowedHosts (step 7-sec)

**Perché:** verifica sicurezza di CLAUDE.md: password minime di soli 6 caratteri, id di `GetStati` senza lunghezza massima, `AllowedHosts` aperto.

**Cosa:** `IdentityServices`: `Password.RequiredLength = MinPasswordLength` (10; restano le regole predefinite di Identity su maiuscole/minuscole/cifre/simboli), vale per `/api/admin/utenti` e per gli endpoint `/api/auth`. `EventiEndpoints.GetStatiAsync`: `400` se un id supera `EventoModel.MaxIdLength` (100). `AllowedHosts` non modificato (`appsettings.json` non si tocca): in produzione si imposta con la variabile d'ambiente, annotato nel piano per lo step 8. Test: password troppo corta (`AdminUtentiTests`), troppi id / id troppo lunghi / id al limite (`EventiApiTests`).

**Note:** build 0 errori, 121/121 test. Le password già esistenti non sono toccate: la regola vale per le nuove. Resta S6 (test con input malevoli).

## 2026-10-23 — Supporto al reverse proxy nginx (step 7-sec)

**Perché:** in produzione davanti all'API ci sarà nginx (Docker): senza gestire gli header `X-Forwarded-*` tutti i client risultano lo stesso IP (i rate limit per IP li bloccherebbero a gruppi) e lo schema HTTPS non è visibile (HSTS/redirect).

**Cosa:** backend: `ServiceCollectionExtensions.ConfiguraForwardedHeaders` (X-Forwarded-For e -Proto, `ForwardLimit` 1; proxy fidati da `ForwardedHeaders:KnownProxies` e `ForwardedHeaders:KnownNetworks` in CIDR; senza configurazione vale solo il loopback e gli header sono ignorati, quindi nessuno spoofing dell'IP) e `app.UseForwardedHeaders()` come primo middleware in `Program.cs`. Frontend: `config.service.ts` ora ha `apiBaseUrl` di default `""` (stessa origine, come nginx che serve il frontend e inoltra `/api`); `public/config.json` era già `""`. Nuovo `ForwardedHeadersTests` (proxy fidato: limite per client reale; non fidato: header ignorato). Piano: S4 segnato fatto, topologia nginx descritta nello step 8.

**Note:** build 0 errori, 117/117 test, `ng build` ok. In compose servirà `ForwardedHeaders__KnownNetworks__0` con la subnet Docker (step 8). Nessuna modifica ad `appsettings*.json`. Restano S5-S6.

## 2026-10-23 — HSTS fuori da Development (step 7-sec)

**Perché:** verifica sicurezza di CLAUDE.md: mancava l'header `Strict-Transport-Security`, che impedisce ai browser di tornare su HTTP.

**Cosa:** `Program.cs`: `app.UseHsts()` fuori da Development, prima di `UseHttpsRedirection` (opzioni predefinite: 30 giorni; l'header viene emesso solo su richieste HTTPS e non per localhost). Nuovo `HstsTests` (Production → header con `max-age`; Development → nessun header).

**Note:** build 0 errori, 115/115 test. Dietro un proxy che termina l'HTTPS servirà `ForwardedHeaders` (S4/step 8) perché il server veda lo schema HTTPS. Restano S4-S6.

## 2026-10-23 — Niente utenti seed con password di esempio fuori da Development (step 7-sec)

**Perché:** `appsettings.json` contiene Admin/Editor con password note (`Admin!12345`, `Editor!12345`): su un server dove nessuno le sostituisce sarebbero stati creati account con credenziali pubbliche.

**Cosa:** `IdentitySeeder.CreaUtenteAsync` non crea l'utente se l'ambiente non è Development e la password è una di quelle di esempio; scrive un avviso nel log (senza la password). Nessuna modifica ad `appsettings*.json`. Nuovo `SeedSicurezzaTests` (Production/Testing → utente non creato; Development → creato; password propria in Production → creato).

**Note:** build 0 errori, 113/113 test. Attenzione: chi avvia in Production senza `appsettings.local.json` o variabili d'ambiente non avrà più Admin/Editor di esempio (voluto). Restano S3-S6.

## 2026-10-23 — Lunghezze massime sui campi dell'evento (step 7-sec)

**Perché:** verifica sicurezza di CLAUDE.md: l'insert anonimo accettava testi di dimensione arbitraria (colonne `nvarchar(max)`, solo il limite di 5 MB per richiesta) e un `Id` oltre 450 caratteri dava 500.

**Cosa:** `[StringLength]` su `EventoModel` con costanti pubbliche (`MaxIdLength` 100, `MaxNomeLength` 200, `MaxCittaLength` 100, `MaxDescrizioneLength` 4000, gli stessi limiti del form Angular); applicati dal validatore esistente → `400`. Nessuna migrazione né modifica al DB. Piano: nuovo step 7-sec (S1-S6) prima di 7-quater. Test in `EventiApiTests`: campi oltre il limite rifiutati (4 casi), campi esattamente al limite accettati.

**Note:** build 0 errori, 109/109 test. Restano S2-S6 (password di esempio, HSTS, ForwardedHeaders, politica password/AllowedHosts/id di GetStati, test con input malevoli), ognuno dopo il "vai".

## 2026-10-23 — Commenti interni `//` tradotti in inglese

**Perché:** completare l'allineamento delle lingue dei commenti richiesto dall'utente (dopo i commenti XML).

**Cosa:** tradotti in inglese i commenti `//` italiani in `EventoModel`, `AdminUtentiEndpoints`, `EventiEndpoints`, `RevisioneEndpoints`, `IdentitySeeder`, `IdentityServices`, `OpenApiServices`, `ServiceCollectionExtensions`, `EventiHostedService`, `EfCoreEventiService`, `Program` e nei test (`AdminUtentiTests`, `ApiFactory`, `EventiApiTests`, `ScadenzaEventiTests`). Solo commenti: nessuna modifica al comportamento. Non toccati Angular e Migrations.

**Note:** build 0 errori, 104/104 test. Gli avvisi nullable nei test (`AdminUtentiTests`) sono preesistenti e rientrano nello step 7-quater. Verifica sicurezza (CLAUDE.md) eseguita solo in lettura: esiti riportati all'utente, nessuna correzione applicata.

## 2026-10-23 — Commenti XML in inglese sui metodi pubblici

**Perché:** regola di CLAUDE.md: i metodi pubblici hanno un commento in inglese; quelli presenti in italiano vanno tradotti.

**Cosa:** aggiunti `/// <summary>` in inglese ai metodi pubblici che ne erano privi (`Map*Endpoints`, `Add*Services`, `ToEntity`, `Intervallo`, `StartAsync`/`StopAsync`, `ExecuteAsync`, `Main`, `GetFusionCacheDefaultOptions`) e `/// <inheritdoc />` sulle implementazioni di `IEventiService` in `EfCoreEventiService`; tradotti in inglese i commenti XML italiani esistenti (endpoint, `Extensions`, `EventoMappings`, `EventoValidator`, `ScadenzaEventiOptions`, `EventiHostedService`, `Evento`, `Ruoli`/`Policies`, `IEventiService`, `RevisioneModels`, `StatoModerazione`). Solo commenti: nessuna modifica al comportamento.

**Note:** i commenti `//` interni e i test restano com'erano; build 0 errori/0 avvisi, 104/104 test.

## 2026-10-23 — Scadenza automatica, rifiuto senza comunicazione, home a tutta larghezza

**Perché:** la conclusione di un evento non è più una scelta degli utenti ma la decide il server; un rifiuto non va comunicato a chi ha segnalato (la nota resta solo come storico per lo staff); testo della home a tutta larghezza.

**Backend:**
- `HostedServices/EventiHostedService.cs` riscritto come `BackgroundService` con `PeriodicTimer` (un ciclo alla volta, parte subito, errori registrati senza fermarlo). Intervallo da `Eventi:ScadenzaIntervalloMinuti` (default 60, frazioni ammesse) letto con `IOptionsMonitor` + `OnChange`: vale anche a caldo. Nuova `Options/ScadenzaEventiOptions.cs`; registrazione in `ServiceCollectionExtensions.cs` (`Configure` + `AddHostedService`, alias di `using` per evitare il conflitto col namespace `Options`).
- `EfCoreEventiService`: `ConcludiScadutiAsync` (aggiornamento mirato `ExecuteUpdateAsync`: solo gli eventi non ancora conclusi con `DataFineEvento` < oggi UTC, imposta `DataOraUltimaModifica`, invalida la cache) al posto di `GetEventiScadutiAsync` + `UpdateEventoAsync` (rimossi da `IEventiService`). Un evento già concluso sul server è ignorato in `UpdateEventiAsync` da tutti, Admin compreso; `ApplyFrom` non copia più `EventoConcluso` dal client e `StessoContenuto` non lo confronta.
- Rifiuto: `Motivo` facoltativo in `RevisioneEndpoints` (max 500 se presente; vuoto → `MotivoRifiuto = null`). `GetStatiAsync` restituisce `InAttesa` per un evento rifiutato e non espone più la nota: rimosso `MotivoRifiuto` da `StatoEventoModel` (`SagreEventi.Shared`).
- Test: `ScadenzaEventiTests.cs` (nuovo: conclusione dei soli scaduti, timestamp, non rielaborazione, conteggio, pull incrementale + cache, evento in attesa scaduto, servizio in background con intervallo a caldo), `EventiApiTests.cs` (client non può concludere, concluso non modificabile né riapribile, rifiuto senza motivo, ritiro senza motivo, `GetStati` nasconde il rifiuto), `EventoMappingsTests.cs`.

**Angular:** rimossi "Segna come concluso" (`chiediConclusione`), `EventiStore.concludi` e `rimuoviSegnalazione`; `mie-segnalazioni.page.ts` mostra sempre «In attesa di approvazione» (niente tag «Rifiutata», motivo, «Rimuovi dal dispositivo»); dettaglio evento: un `Rifiutato` locale appare come in attesa; `revisione.page.ts`: nota facoltativa (pulsante sempre attivo, testo aggiornato, colonna «Nota»); `core/models.ts`, `revisione.service.ts` (motivo vuoto non inviato). Home: tolto `max-width: 46ch` da `.hero-testo` in `styles.css`. `README.md` aggiornato.

**Verifica:** `dotnet build` 0 errori, `dotnet test` 104/104, `ng build` ok. Non provato nel browser né su SQL Server reale (`ExecuteUpdateAsync` provato solo su SQLite).

**Note/da fare:** `Eventi:ScadenzaIntervalloMinuti` non è in `appsettings.json` (non toccato per vincolo): vale il default 60. Una segnalazione rifiutata resta «in attesa» per sempre sul dispositivo di chi l'ha fatta (scelta voluta). Le vecchie copie locali con stato `Rifiutato` sono mostrate come in attesa e riallineate alla prossima sincronizzazione. Restano 8 (Docker) e 9 (documentazione).

## 2026-10-23 — Revisione e Amministrazione raggruppate in "Gestione"

**Perché:** un Admin aveva 7 voci nella barra mobile; le due sezioni di gestione ora sono una sola voce con schede.

**Dove:** `features/gestione/gestione.page.ts` (nuovo, barra schede Revisione (n) / Utenti, Utenti solo Admin), `app.routes.ts` (`/gestione` con figlie `revisione` e `utenti`; `/revisione` e `/amministrazione` ora sono redirect), `app.ts` (voce unica "Gestione (n)" per chi può modificare), `README.md` (percorsi).

**Verifica:** `ng build` ok. Non provato nel browser.

**Aggiunta:** testo introduttivo di Revisione e Utenti a tutta larghezza: `.pagina-intro` aveva `max-width: 60ch`; nuova classe `.larga` in `styles.css` (`max-width: none`) applicata solo a queste due pagine.

## 2026-10-23 — Sezione Amministrazione (gestione utenti)

**Perché:** finora gli utenti si creavano solo dal seed; l'Admin deve poterli gestire dall'interfaccia.

**Backend:**
- `Endpoints/AdminUtentiEndpoints.cs` (nuovo, registrato in `Program.cs`), gruppo `/api/admin` con policy `SoloAdmin` (nuova in `Models/Identity/Ruoli.cs` e `IdentityServices.cs`): `GET ruoli` (sola lettura, Admin/Editor fissi), `GET utenti`, `POST utenti` (email, password, ruoli → 201), `PUT utenti/{id}` (email = anche username, password opzionale, `ruoli` sostituisce l'insieme), `DELETE utenti/{id}` (204).
- Validazione: email valida ≤256, ruoli solo quelli esistenti, regole password di Identity (400 con ValidationProblem; email duplicata → 400). Salvaguardie → 409: non cancellarsi, non togliersi Admin, non rimuovere/cancellare l'ultimo Admin. Un cambio di ruoli aggiorna il security stamp (il refresh token vecchio non vale più).
- `tests/.../AdminUtentiTests.cs` (nuovo): 401/403 su ogni endpoint, creazione e validazioni, modifica (login con nuova email/password), 404, salvaguardie, cancellazione. **82/82** test.

**Angular:** `core/admin-utenti.service.ts` (client + `messaggioErroreApi`), `features/amministrazione/amministrazione.page.ts` (tabella, dialog crea/modifica con multiselect ruoli, conferma di eliminazione), guard `richiedeAdmin` in `permessi.service.ts`, rotta `/amministrazione`, voce di menu solo per Admin (`app.ts`). `README.md` aggiornato.

**Verifica:** `dotnet build` 0/0, `dotnet test` 82/82, `ng build` ok. Non provato nel browser.

**Note/da fare:** gli access token già emessi restano validi fino a scadenza anche dopo un cambio ruolo o una cancellazione (la durata è quella di Identity, 1 ora); i refresh token no. Non esistono endpoint separati per assegnare/revocare un ruolo: lo fa il `PUT` con l'elenco completo. Restano 7-ter, 8, 9.

## 2026-10-23 — Ritiro dalla pagina di revisione e chiusura

**Perché:** completare il piano: poter ritirare un evento già approvato dall'interfaccia e documentare il flusso.

**Dove:**
- `features/revisione/revisione.page.ts`: nuova scheda "Approvati" (eventi pubblici dello store locale) con "Ritira…" (dialog con motivo, usa `Revisione/Rifiuta` → tombstone); dopo il ritiro sincronizza e ricarica.
- `README.md`: sezione "Moderation", voci "Report/Review", nuovi endpoint in tabella, tolta la voce da "What's next".

**Verifica:** `ng build` ok, `dotnet build` ok, `dotnet test` 58/58. Id eventi = `crypto.randomUUID` (non indovinabili per `GetStati`). Giro a mano nel browser e prova su SQL Server reale NON fatti.

**Note/da fare:** dopo la migrazione approvare gli eventi esistenti da `/revisione`. La scheda Approvati dipende dallo store locale (serve essere sincronizzati).

## 2026-10-23 — Pagina di revisione in Angular

**Perché:** Editor e Admin devono poter approvare o rifiutare le segnalazioni (e approvare in blocco gli eventi esistenti, tutti `InAttesa`) dall'interfaccia.

**Dove (Angular):**
- `core/revisione.service.ts` (nuovo): client di `GET Revisione/DaRivedere`, `POST Revisione/Approva|Rifiuta`; signal `inAttesa` per il contatore.
- `features/revisione/revisione.page.ts` (nuovo, rotta `/revisione` con guard `richiedeModifica`): schede In attesa / Rifiutati, `p-table` con selezione multipla (max 100 per richiesta), Approva, Rifiuta con dialog del motivo (obbligatorio, max 500); dopo ogni azione ricarica la lista e mostra un toast. Nei Rifiutati si può ri-approvare.
- `app.ts`: voce di menu "Revisione (n)" solo per chi può modificare; il contatore si aggiorna all'avvio, al cambio ruolo e al ritorno online. `app.routes.ts`, `core/models.ts` (`motivoRifiuto`, `EsitoRevisione`).

**Verifica:** `ng build` ok. Non provato nel browser.

**Note/da fare:** il ritiro di un evento già approvato non ha ancora un pulsante (l'endpoint c'è); il contatore non si aggiorna in tempo reale. M6: chiusura e nota nel README.

## 2026-10-23 — Angular store/segnalazione + `403` per modifiche non autorizzate

**Perché:** (a) decisione dell'utente: modificare un evento esistente senza ruolo deve dare `403` invece di essere ignorato con `200`; (b) chi segnala un evento deve vederlo "in attesa" sul proprio dispositivo e conoscerne l'esito.

**Backend:**
- `EfCoreEventiService.UpdateEventiAsync` ora restituisce `bool`: `false` se il payload contiene una modifica vera a un evento esistente senza policy `PuoModificare` (i nuovi eventi della richiesta sono inseriti comunque). Un re-invio identico a quanto salvato (`StessoContenuto`) resta innocuo, così un retry dopo risposta persa non dà errore. `EventiEndpoints.UpdateEventiAsync` risponde `403` (ProblemDetails). `IEventiService` aggiornata.
- Test: 3 test esistenti ora attendono `403`, nuovo test del re-invio identico (58/58).

**Angular:**
- `core/models.ts`: `Evento.stato`, `StatoModerazione`, `EsitoModerazione`, `EventoLocale.mio`/`motivoRifiuto`. `eventi-api.service.ts`: `getStati(ids)`.
- `eventi-store.service.ts`: `crea` marca `mio` e `stato` (InAttesa, o Approvato se l'utente può modificare); `eventi()` mostra solo gli approvati (o senza stato, dati legacy); nuovo `mieSegnalazioni`; `aggiornaStati()` dopo il pull chiama `GetStati` (blocchi da 50) per le mie non approvate, errori ignorati; `unisci` conserva `mio` e prende `stato` dal server; `rimuoviSegnalazione(id)`.
- `evento-form.page.ts`: messaggio "Sarà visibile a tutti dopo la revisione". `evento-detail.page.ts`: avviso In attesa/Rifiutata con motivo.
- Nuova pagina `features/segnalazioni/mie-segnalazioni.page.ts` (rotta `/segnalazioni`) con badge e rimozione delle rifiutate; voce di menu "Le mie" (`app.ts`, `link` ora `computed`) visibile solo se ci sono segnalazioni in sospeso.
- `README.md` e `PLAN-migrazione-backend.md` allineati alla decisione 403.

**Verifica:** `dotnet build` 0/0, `dotnet test` 58/58, `ng build` ok. Non provato nel browser.

**Note/da fare:** M5 (pagina `/revisione`) per approvare dall'interfaccia. Un evento rifiutato non genera notifiche: l'autore lo scopre alla sincronizzazione.

## 2026-10-23 — Endpoint di revisione e `GetStati`

**Perché:** permettere a Editor/Admin di approvare, rifiutare o ritirare gli eventi segnalati, e a chi ha segnalato di conoscere l'esito.

**Dove:**
- `Endpoints/RevisioneEndpoints.cs` (nuovo), gruppo `/api/Eventi/Revisione` con policy `PuoModificare` (401 anonimo, 403 senza ruolo): `GET /DaRivedere?stato=InAttesa|Rifiutato` (default InAttesa, più vecchi per primi, max 200, `Approvato` → 400), `POST /Approva {ids}`, `POST /Rifiuta {ids, motivo}` (max 100 id, id non vuoti, motivo obbligatorio max 500). Risposta `{modificati}`; id sconosciuti o già nello stato richiesto sono ignorati. Registrato in `Program.cs`.
- `EfCoreEventiService` / `IEventiService`: `GetDaRivedereAsync`, `ApprovaAsync`, `RifiutaAsync`, `GetStatiAsync`. Ogni revisione imposta `RevisionatoDa` (email dal claim), `DataRevisione`, nuovo `DataOraUltimaModifica` (cursore di sync) e invalida la cache. Rifiutare un evento approvato lo ritira: `Rifiutato` + `EventoConcluso` (tombstone, i client lo eliminano). Approvare un rifiutato/ritirato azzera il motivo e ricalcola `EventoConcluso` (vero solo se `DataFineEvento` è passata).
- `EventiEndpoints.cs`: `GET /api/Eventi/GetStati?ids=` anonimo (1–50 id), rate limit policy `stati` (`Eventi:RichiesteStatiAlMinuto`, default 30, in `ServiceCollectionExtensions.cs` e `appsettings.json`). Restituisce solo `{id, stato, motivoRifiuto}` (motivo solo se rifiutato).
- `SagreEventi.Shared/Models/RevisioneModels.cs` (nuovo): `StatoEventoModel`, `ApprovaEventiRequest`, `RifiutaEventiRequest`, `RevisioneEsito`.
- `EventiApiTests.cs`: 15 test nuovi (401/403, elenco, approvazione singola/multipla con cache invalidata, validazioni, rifiuto con motivo, ritiro con tombstone, GetStati).

**Verifica:** `dotnet build` 0 errori/0 avvisi; `dotnet test` 57/57 (3 esecuzioni). Non provato su SQL Server né dal browser.

**Note/da fare:** la UI non esiste ancora (M4 segnalazione, M5 revisione): finché non c'è, gli eventi esistenti si approvano solo via API. Un evento ritirato e poi riapprovato con data già passata resta concluso (coerente con la futura scadenza automatica 7-ter).

## 2026-10-23 — Insert come InAttesa/Approvato e `GetEventi` filtrato

**Perché:** gli eventi segnalati dagli anonimi non devono essere visibili finché non revisionati.

**Dove:**
- `EfCoreEventiService.ApplicaAsync`: un evento nuovo nasce `Approvato` se chi scrive ha la policy `PuoModificare`, altrimenti `InAttesa`; lo stato non viene mai dal payload e un update di un revisore non lo cambia.
- `EfCoreEventiService.GetEventiAsync`: usa `EventoMappings.VisibilePubblico` (`Approvato`, oppure `Rifiutato` + `EventoConcluso`) e `ToDtoPubblico`. Gli `InAttesa` e i `Rifiutato` non conclusi non escono mai, nemmeno se scaduti.
- **Tombstone:** un evento ritirato (Rifiutato + concluso, impostato in M3) esce solo con id e date, con nome/città/descrizione vuoti e senza motivo, così il client lo elimina ma non riceve il contenuto rifiutato. La cache resta una sola (la lettura è uguale per tutti).
- Test (42/42): anonimo/senza ruolo → InAttesa, Editor/Admin → Approvato, stato inviato dal client ignorato, update del revisore non cambia lo stato, GET senza InAttesa/Rifiutati, GET con approvati, tombstone senza contenuto, InAttesa scaduto non esce. I test esistenti che leggevano dopo un insert anonimo ora inseriscono come Editor. `ClientConRuoloAsync` mette in cache il token per ruolo (il login ha il limite 10/min per IP, con più test andava in 429).

**Verifica:** `dotnet build` 0/0, `dotnet test` 42/42 (3 run). Non provato su SQL Server né nel browser.

**Note/da fare:** da ora gli eventi esistenti nel DB (tutti `InAttesa` dopo la migrazione) spariscono dal sito finché non c'è la revisione (M3/M5); lato Angular l'evento appena segnalato non compare più nella lista dell'autore fino a M4. Prossimo: M3 (endpoint di revisione e `GetStati`), in attesa del "vai".

## 2026-10-23 — Modello dati e migrazione `AddModerazione`

**Perché:** primo step di `PLAN-moderazione-eventi.md`: serve uno stato di revisione per nascondere gli eventi non approvati (il filtro è in M2, per ora il comportamento pubblico è invariato).

**Dove:**
- `Shared/Models/StatoModerazione.cs` (nuovo): enum `InAttesa=0 / Approvato / Rifiutato`, serializzato come stringa (`[JsonConverter]`). `EventoModel`: `Stato` e `MotivoRifiuto` (solo output, il server li ignora in ingresso).
- `Web.Server/Models/Entities/Evento.cs`: `Stato`, `MotivoRifiuto` (max 500), `RevisionatoDa` (max 256, email), `DataRevisione`. `AppDbContext`: lunghezze massime.
- `EventoMappings`: `ToDto` proietta `Stato`/`MotivoRifiuto`; `ToEntity`/`ApplyFrom` non li copiano mai dal client.
- Migrazione `20261023114159_AddModerazione`: 4 colonne su `Eventi`, `Stato` int NOT NULL default 0 → **tutti gli eventi esistenti diventano `InAttesa`** (decisione del piano). `has-pending-model-changes` pulito. **Non applicata**: parte da sola all'avvio (`Database:MigraAllAvvio`).
- Test `EventoMappingsTests` (3): 32/32 in totale.

**Note/da fare:** appena applicata la migrazione gli eventi esistenti restano visibili fino a M2 (poi spariscono dal pubblico finché non approvati da M3/M5). L'Angular riceve il nuovo campo `stato` e lo ignora. Prossimo: M2 (insert come InAttesa/Approvato e filtro su `GetEventi`), in attesa del "vai".

## 2026-10-23 — README aggiornato (Identity, ruoli, seed, limiti, CORS, solo API)

**Dove:** `README.md`: intro e scope (login Admin/Editor, niente registrazione pubblica), tecnologie, tabella endpoint (`/api/auth/*`, limiti del PUT, timestamp deciso dal server), quickstart con `appsettings.local.json` e seed all'avvio, tabella configurazione (`Identity:*`, `Database:MigraAllAvvio`, `Eventi:*`, `Cors:Origins`), nota CORS/proxy, "What's next" con moderazione e 7-bis/7-ter.

## 2026-10-23 — Rimozione del client Blazor (backend solo API)

**Perché:** il frontend è solo Angular; il server non deve più ospitarlo.

**Dove:**
- Eliminata la cartella `src/SagreEventi.Web.Client` (tracciata in git: recuperabile) e tolta da `SagreEventi.sln`; aggiunto `PLAN-moderazione-eventi.md` tra i Solution Items.
- `Web.Server.csproj`: rimossi `ProjectReference` al Client e il pacchetto `Microsoft.AspNetCore.Components.WebAssembly.Server`. `Program.cs`: rimossi `UseWebAssemblyDebugging`, `UseBlazorFrameworkFiles`, `UseStaticFiles`, `MapFallbackToFile`. `launchSettings.json`: tolto `inspectUri` di Blazor.
- `SagreEventi.Shared`: eliminato `Models/EventiStore.cs`; tolto `SupportedPlatform browser` dal csproj.
- README e commenti Angular: tolti i riferimenti a Blazor.

**Verifica:** `dotnet build` 0 errori/0 avvisi, `dotnet test` 29/29, `ng build` ok. Il server alla radice (`/`) ora risponde 404: l'UI è su Angular.

**Note/da fare:** il README descrive ancora l'app come "senza account né autenticazione" (non aggiornato per Identity); `.github/copilot-instructions.md` non citava Blazor. Restano da decidere: 403 vs "ignora con 200"; prossimo step (moderazione M1, 7-bis, 7-ter), in attesa del "vai".

## 2026-10-23 — Correzioni da analisi bug (cursore, id duplicati, Bearer null, limiti)

**Perché:** un client poteva avvelenare il cursore di sync con `DataOraUltimaModifica` futura; id duplicati davano 500; l'insert anonimo era senza limiti.

**Dove:**
- `EfCoreEventiService.UpdateEventiAsync`: `DataOraUltimaModifica = UtcNow` deciso dal server su insert e update (il valore del client serve solo al confronto "più recente vince"); dedup per id nel batch; su `DbUpdateException` un solo retry (id inserito in concorrenza).
- `EventiEndpoints`: max `Eventi:MaxPerRichiesta` (default 20) eventi per PUT → 400; rate limit `scrittura` su `PUT /UpdateEventi` (`Eventi:RichiestePutAlMinuto`, default 10/min per IP, letto a runtime). `ServiceCollectionExtensions` registra la policy; `appsettings.json` ha la sezione `Eventi`.
- Angular `auth.interceptor.ts`: niente header `Bearer null` dopo un rinnovo fallito; `eventi-store.service.ts`: push a blocchi da 20 (`MAX_EVENTI_PER_RICHIESTA`, da tenere allineato al server).
- Test (29/29): timestamp server, id duplicati, limite 20/21, 429; i test esistenti usano tempi relativi a `UtcNow`; `ApiFactory` alza il rate limit a 1000.

**Verifica:** `dotnet test` 29/29, `tsc` e `ng build` ok. Non provato nel browser.

**Note/da fare:** il comportamento "ignora con 200" per i non autorizzati resta (decisione 403 aperta). Prossimo: step 7 (rimozione Blazor) o M1 della moderazione, in attesa del "vai".

## 2026-10-23 — Moderazione degli eventi segnalati (nessuna modifica al codice)

**Perché:** gli eventi segnalati da anonimi erano subito pubblici; devono essere visibili solo dopo la revisione di un Editor/Admin.

**Dove:** nuovo `PLAN-moderazione-eventi.md` (step M1–M6: stato `InAttesa/Approvato/Rifiutato`, filtro sul `GetEventi` pubblico, endpoint `/api/Eventi/Revisione`, `GetStati` per il segnalante, store e pagina `/revisione` in Angular). Decisioni: eventi esistenti tutti `InAttesa`, rifiutati conservati, si parte dopo il 6-bis, gestione utenti resta al 7-bis (solo Admin).

**Da fare:** attendere il "vai" (prima il 6-bis, poi M1).

## 2026-10-23 — Seed al primo avvio: migrazioni, Admin ed Editor con dati fittizi

**Perché:** il seed esisteva ma senza configurazione non creava nessun utente e non applicava le migrazioni.

**Dove:**
- `appsettings.json`: `Database:MigraAllAvvio=true`, `Identity:Admin` (`admin@sagreeventi.local` / `Admin!12345`) e `Identity:Editor` (`editor@sagreeventi.local` / `Editor!12345`), `Cors:Origins` = `http://localhost:4200`. Valori **fittizi**: da sovrascrivere in `appsettings.local.json`.
- `Extensions/IdentitySeeder.cs`: `MigrateAsync` all'avvio (solo SQL Server, se il flag è attivo), poi ruoli e utenti Admin/Editor tramite helper `CreaUtenteAsync`.

**Verifica:** `dotnet test` 23/23 (build in una cartella `artifacts` alternativa perché l'API in debug bloccava i file). Non provato contro SQL Server.

**Note/da fare:** cambia le password prima di ogni deploy; in produzione valuta `MigraAllAvvio=false`. Nessun evento di esempio.

## 2026-10-23 — Fix: pagina bianca all'avvio di Angular (NG0203)

**Perché:** nell'initializer di `app.config.ts` `inject(AuthService)` veniva chiamato dopo un `await`, fuori dal contesto di iniezione: il bootstrap falliva e restava la pagina bianca.

**Dove:** `src/SagreEventi.Web.Angular/src/app/app.config.ts` (i due `inject()` ora prima dell'`await`).

**Verifica:** `ng build` ok; non provato nel browser.

## 2026-10-23 — Aggiunti step 6-bis e 7-ter, salvato lo stato per riprendere (nessuna modifica al codice)

**Perché:** chiusura sessione. Nel piano `PLAN-migrazione-backend.md` c'è ora la sezione "Stato avanzamento" (cosa è fatto, prossimo step, decisioni aperte, azioni manuali dell'utente).

**Dove:** solo `PLAN-migrazione-backend.md`: **6-bis** (cursore di sync avvelenabile da `DataOraUltimaModifica` inviata dal client, id duplicati → 500, interceptor `Bearer null`, limiti all'insert anonimo); **7-ter** (scadenza automatica eventi con intervallo in `appsettings.json`, nessuna conclusione manuale, eventi conclusi non modificabili da nessuno); nota sul 403 da valutare nello step 5.

**Da fare alla ripresa:** attendere il "vai" dell'utente sul 6-bis (o sul 7). Decisioni aperte: limiti del punto 6-bis.4.

## 2026-10-23 — Angular con login, token Bearer e permessi da ruolo

**Perché:** abilitare la modifica degli eventi nel frontend solo a chi ha fatto login con ruolo Admin/Editor.

**Dove:**
- Backend `Extensions/IdentityServices.cs`: nuovo `GET /api/auth/me` (richiede token, senza rate limit) → `{ email, ruoli[] }` letti dal DB. Test `Me_*` in `AuthTests.cs`.
- Angular `core/auth.service.ts`: login (`/api/auth/login` poi `/me`), logout, rinnovo con refresh token (condiviso tra chiamate concorrenti), sessione in `sessionStorage`, `aggiornaUtente()` all'avvio per riallineare i ruoli.
- Angular `core/auth.interceptor.ts`: Bearer solo verso `apiBaseUrl`; rinnova prima dell'invio se scaduto (un token scaduto sarebbe anonimo e il server ignorerebbe le modifiche con 200); su 401 un solo retry dopo il rinnovo.
- Angular `core/permessi.service.ts`: `autenticato` da `AuthService`, `eAdmin`, `puoModificare()` = Admin o Editor; la guard `richiedeModifica` resta.
- Angular `core/eventi-store.service.ts` + `models.ts`: flag `protetta` su modifica/conclusione; senza ruolo la sync non le invia (restano `dirty`, niente perdita silenziosa) e le invia dopo il login.
- Angular `features/login/login.page.ts`, rotta `/login`, `app.ts` (Accedi / Esci nella topbar), `app.config.ts` (`withInterceptors`, initializer).

**Verifica:** `dotnet build` 0 errori/0 avvisi, `dotnet test` 23/23; `tsc --noEmit` e `ng build` ok. Non provato nel browser contro un'API reale.

**Note/da fare:** serve `dotnet ef database update` e `Identity:Admin:*` in `appsettings.local.json`; `Cors:Origins` deve includere l'origine di Angular. I ruoli si riallineano al caricamento della pagina. Prossimo: step 7 (rimozione Blazor), in attesa di conferma.

## 2026-10-23 — Modifica protetta lato server (+ nuovo step 7-bis nel piano)

**Perché:** solo chi ha ruolo Admin/Editor può modificare eventi esistenti; l'inserimento di eventi nuovi resta anonimo.

**Dove:**
- `PLAN-migrazione-backend.md`: aggiunto lo **step 7-bis** (sezione "Amministrazione": gestione utenti con creazione/modifica/cancellazione/assegnazione ruoli, ruoli non modificabili, solo Admin loggato; backend `/api/admin/utenti` + Angular `/amministrazione`).
- `Endpoints/EventiEndpoints.cs`: `UpdateEventi` resta unico e anonimo; verifica la policy `PuoModificare` con `IAuthorizationService` e passa `consentiModifiche` al servizio.
- `IEventiService`/`EfCoreEventiService.UpdateEventiAsync(eventi, consentiModifiche, ct)`: eventi nuovi sempre inseriti; quelli già esistenti sono aggiornati (last-write-wins) solo se `consentiModifiche`.
- Test (21/21): anonimo e utente senza ruolo non modificano esistenti, anonimo inserisce i nuovi anche in una richiesta mista, Editor e Admin modificano; i test di update esistenti ora usano un Editor (helper `ClientConRuoloAsync`).

**Note:** scelta di comportamento: per chi non ha permessi gli eventi esistenti sono **ignorati con 200** (non 403), così i re-invii della sync (evento già inserito ma ancora `dirty` sul client) non bloccano l'intero batch; se preferisci 403 va cambiato. Il token non valido/scaduto è trattato come anonimo. L'Angular non invia ancora il token (step 6).
**Prossimo:** step 6 (Angular: login, interceptor, PermessiService), in attesa di conferma.

## 2026-10-23 — ASP.NET Core Identity (solo ruoli)

**Perché:** autenticazione con bearer token e ruoli per abilitare in seguito la modifica degli eventi (la protezione degli endpoint è lo step 5).

**Dove (src/SagreEventi.Web.Server):**
- `Models/Identity/ApplicationUser.cs`, `Ruoli.cs` (ruoli `Admin`, `Editor`; policy `PuoModificare`).
- `AppDbContext` ora è `IdentityDbContext<ApplicationUser>` (stesso DB e tabella `dbo.Migrations`). Migrazione `AddIdentity` (solo 7 tabelle AspNet*, `Eventi` invariata; `has-pending-model-changes` pulito). **Non applicata a nessun DB**: serve `dotnet ef database update` prima di avviare l'API.
- `Extensions/IdentityServices.cs`: `AddIdentityApiEndpoints` + ruoli, policy `PuoModificare` (Admin/Editor), rate limiting `auth` (10 richieste/min per IP), `MapAuthEndpoints` → `/api/auth/*` (login, refresh, manage/info…). **Registrazione pubblica disattivata** (`/api/auth/register` → 404) salvo `Identity:RegistrazionePubblica=true`.
- `Extensions/IdentitySeeder.cs`: hosted service che all'avvio crea i ruoli e, se presenti `Identity:Admin:Email` e `Identity:Admin:Password`, il primo Admin (metterli in user-secrets/`appsettings.local.json`/variabili d'ambiente, mai in `appsettings.json`).
- CORS: `Cors:Origins` (array) con `WithOrigins`; senza configurazione nessuna origine cross-origin è ammessa (niente `AllowAnyOrigin`, niente credenziali).
- `Program.cs`: `UseRateLimiter`, `UseAuthentication`, `UseAuthorization` dopo `UseCors`. csproj: `Microsoft.AspNetCore.Identity.EntityFrameworkCore 10.0.13`.
- Test: `AuthTests` (login ok/ko, registrazione 404, seed Admin, manage/info con token, rate limit 429); `ApiFactory` con config Admin in memoria e creazione schema prima del seed. 17/17 ok.

**Note:** gli endpoint eventi sono ancora tutti anonimi (step 5). Il token di `MapIdentityApi` è opaco (non JWT). In dev serve `Cors:Origins` solo se l'Angular non usa il proxy. Test flaky risolto: il timer di `EventiHostedService` usava in parallelo la connessione SQLite condivisa (non thread-safe) insieme al seed; in `ApiFactory` ora è rimosso (10 run consecutive ok).
**Prossimo:** step 5 (fatto).

## 2026-10-23 — OpenAPI nativo + schema Bearer

**Perché:** sostituire Swashbuckle con `Microsoft.AspNetCore.OpenApi` (nativo .NET 10) e predisporre lo schema Bearer per gli endpoint protetti degli step 4-5.

**Dove (src/SagreEventi.Web.Server):**
- `Extensions/OpenApiServices.cs` (nuovo, sostituisce `SwaggerServices.cs` eliminato): `AddOpenApi("v1")` con document transformer (info/contatto/licenza come prima + security scheme `Bearer`, HTTP bearer).
- `Program.cs`: in Development `app.MapOpenApi()` (documento su `/openapi/v1.json`) al posto di `UseSwagger/UseSwaggerUI`. `ServiceCollectionExtensions`: `AddOpenApiServices()`.
- csproj: `Swashbuckle.AspNetCore` → `Microsoft.AspNetCore.OpenApi 10.0.13`.
- Test: `OpenApiTests` (documento in Development espone i 2 endpoint e lo schema Bearer). 11/11 ok, build 0 errori/0 avvisi.

**Note:** l'OpenAPI nativo non include una UI: non c'è più `/swagger`, solo il JSON (importabile in Postman/Scalar/Swagger Editor). Lo schema Bearer non è ancora applicato a operazioni specifiche (requirement per-endpoint negli step 4-5). `GenerateDocumentationFile` lasciato com'è.
**Prossimo:** step 4 (fatto).

## 2026-10-23 — Minimal API

**Perché:** passare da MVC (`Startup` + controller) a Minimal API mantenendo identico il contratto (`GET api/Eventi/GetEventi?since=`, `PUT api/Eventi/UpdateEventi`, 200 a body vuoto).

**Dove (src/SagreEventi.Web.Server):**
- Eliminati `Startup.cs`, `Controllers/EventiController.cs`, `Pages/Error.cshtml(.cs)` (Razor Pages/MVC rimossi).
- `Endpoints/EventiEndpoints.cs` (nuovo): `MapGroup("/api/Eventi")`, validazione con `EventoValidator` → `Results.ValidationProblem` (400). `since` è `DateTime?` (con `DateTime = default` il binding va in errore; assente = `default` come prima).
- `Extensions/ServiceCollectionExtensions.cs` (nuovo): `AddApplicationServices` (servizi di Startup + `AddProblemDetails`, `JsonOptions`); `Program.cs` ridotto a pipeline (`UseExceptionHandler` fuori da Development; Swagger/WebAssemblyDebugging in Development).
- `EfCoreEventiService`: ora riceve `IFusionCache` (non più cache privata per istanza); chiavi con `since`/`dataOdierna` (`.Ticks`); tag `eventi` e `RemoveByTagAsync` dopo ogni `SaveChanges` così un GET dopo un PUT non legge dati vecchi. `ApplicationExtension.GetFusionCacheDefaultOptions` ora non è più usato.
- Test: +2 (cache distingue `since`, GET dopo modifica non serve dati vecchi); `ApiFactory` toglie i provider di log (crash a fine test per il timer di `EventiHostedService` sul logger EventLog). 10/10 ok, build 0 errori/0 avvisi.

**Note:** hosting Blazor (`UseBlazorFrameworkFiles`, `UseStaticFiles`, fallback) lasciato fino allo step 7. Swashbuckle resta fino allo step 3. Piano copiato in `PLAN-migrazione-backend.md` (root). Ora la cache è condivisa: prima, essendo per istanza transient, di fatto non cachava.
**Prossimo:** step 3 (fatto).

## 2026-10-23 — DTO ed entità separati

**Perché:** `EventoModel` (Shared) era insieme DTO ed entità EF; ora il contratto con i client resta `EventoModel`, la persistenza usa un'entità del server. Schema DB invariato.

**Dove (src/SagreEventi.Web.Server):**
- `Models/Entities/Evento.cs` (nuovo): entità; date non nullable, stringhe obbligatorie via fluent in `AppDbContext`.
- `Models/Mapping/EventoMappings.cs` (nuovo): `ToDto` (expression, traducibile in SQL), `ToEntity`, `ApplyFrom`.
- `Validation/EventoValidator.cs` (nuovo): validazione esplicita (DataAnnotations di `EventoModel` + Id obbligatorio), usata da `EventiController.UpdateEventiAsync` → 400 `ValidationProblem`.
- `AppDbContext` (`DbSet<Evento>`), `EfCoreEventiService` (mappa DTO↔entità, interfaccia `IEventiService` invariata), `Migrations/AppDbContextModelSnapshot.cs` (nome tipo e `DateTime` non nullable, a mano). `dotnet ef migrations has-pending-model-changes`: nessuna modifica.
- Test: `EventiApiTests` ora legge `Evento`; aggiunti 2 test (400 per evento non valido / senza Id). 8/8 ok.

**Note:** nuovo comportamento: PUT con Id vuoto ora risponde 400 (prima 500 in DB). Usate DataAnnotations invece di FluentValidation (serve solo nel client Blazor, che verrà rimosso). `Designer` della migrazione 2022 lasciato com'è. Il validatore verrà richiamato dall'endpoint nello step 2.
**Prossimo:** step 2 (Minimal API), in attesa di conferma.

## 2026-10-23 — Test di caratterizzazione

**Perché:** rete di sicurezza prima di migrare a Minimal API + Identity; fissa il comportamento attuale dell'API.

**Dove:** nuovo `tests/SagreEventi.Web.Server.Tests` (xUnit + `WebApplicationFactory<Program>`, SQLite in memoria al posto di SQL Server): `ApiFactory.cs`, `EventiApiTests.cs` (PUT insert, evento già concluso ignorato, update se più recente, ignorato se più vecchio; GET con `since`, GET vuoto). Aggiunto a `SagreEventi.sln`. `dotnet test`: 6/6 ok.

**Note:** `appsettings.json` NON toccato (su richiesta: i secrets verranno gestiti in seguito dall'utente, punto 3 dello step 0 saltato). Il bug noto della chiave cache fissa in `EfCoreEventiService` non è coperto dai test (la cache è per istanza del servizio): da verificare allo step 2.

**Prossimo:** step 1 (separare DTO ed entità), in attesa di conferma.

## 2026-10-22 — Modifica eventi inibita (manca login/registrazione)

**Perché:** il backend non ha autenticazione; l'inserimento resta libero, la modifica di eventi esistenti no.

**Dove (src/SagreEventi.Web.Angular/src/app):**
- `core/permessi.service.ts` (nuovo): `PermessiService.autenticato` (signal, `false`) e `puoModificare()`; guardia di rotta `richiedeModifica` (redirect a `/eventi/:id`).
- `app.routes.ts`: `canActivate: [richiedeModifica]` su `eventi/:id/modifica`.
- `features/eventi/evento-detail.page.ts`: pulsanti "Modifica" e "Segna come concluso" visibili solo se `puoModificare()`; `chiediConclusione()` esce se non permesso.
- `core/eventi-store.service.ts`: `aggiorna()` e `concludi()` sono no-op se `!puoModificare()`.

**Da fare / note:** quando ci sarà il login, impostare `PermessiService.autenticato` dalla sessione. Il backend (`EventiController.UpdateEventiAsync`, PUT unico per insert+update) NON è protetto: servirà `[Authorize]` e distinguere insert da update.

<!--
## Contesto del progetto (stabile)

- Backend .NET 10: `src/SagreEventi.Web.Server` (API `api/Eventi/{GetEventi,UpdateEventi}`), client Blazor in `SagreEventi.Web.Client`.
- Frontend Angular + PrimeNG in `src/SagreEventi.Web.Angular`, offline-first (localStorage, sync push dirty poi pull da cursore) in `core/eventi-store.service.ts`.
- Verifica compilazione Angular: `npx tsc --noEmit -p tsconfig.app.json` dalla cartella Angular. Python non è installato.
-->