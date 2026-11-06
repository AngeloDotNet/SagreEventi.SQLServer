# Sincronizzazione offline-first e PWA

[← Torna al README](../README.md)

## Sincronizzazione offline-first

Il client Angular tiene una propria copia degli eventi e si sincronizza con l'API in tre passi:

1. **Push:** gli eventi creati o modificati sul dispositivo sono inviati con `PUT /api/Eventi/UpdateEventi`, ciascuna richiesta con una prova anti-bot (vedi [Protezione anti-bot](anti-bot.md)).
2. **Pull:** le modifiche degli altri sono scaricate con `GET /api/Eventi/GetEventi?since=<cursore>`.
3. **Merge:** i dati del server sostituiscono quelli locali, a meno che la copia locale sia in attesa e più recente. Gli eventi conclusi vengono rimossi.

La sincronizzazione parte all'avvio, quando il browser torna online, quando premi il pulsante di sincronizzazione nella barra in alto e in automatico quando l'app torna in primo piano (almeno 5 minuti dopo l'ultima) e ogni 10 minuti mentre la pagina è aperta e visibile.

## Progressive web app

Il client è una PWA installabile (web manifest, icone, service worker di Angular). Il service worker mette in cache solo i file dell'applicazione, **non** le chiamate `/api`: i dati restano nello store offline-first descritto sopra, così sul dispositivo c'è un'unica fonte di verità.

- **Offline:** le pagine già visitate e la struttura dell'app si aprono senza rete. Il pulsante di sincronizzazione diventa un'icona Wi-Fi barrata e un avviso rosso segnala quando una pagina mai aperta non si può caricare.
- **Aggiornamenti:** il browser scarica una nuova versione in background; l'app chiede al server se ce n'è una nuova ogni ora e quando torna in primo piano (almeno 5 minuti dopo l'ultimo controllo). Quando è pronta compare un'icona di download nella barra in alto (con un breve avviso); cliccandola l'app si ricarica. Niente si ricarica da solo, quindi un modulo in compilazione non va mai perso.
- **Solo in produzione:** il service worker è disattivato con `ng serve`. Per provarlo, servi la build di produzione (`ng build`, poi un qualsiasi server statico) su `localhost` o in HTTPS.
- **Hosting:** `ngsw.json` e `ngsw-worker.js` non vanno mai serviti con una cache HTTP lunga; vedi [DEPLOY.md](../DEPLOY.md#pwa-installazione-offline-e-aggiornamenti).

| Online | Offline | Nuova versione pronta |
|---|---|---|
| <img src="screenshots/pwa-online-home.png" alt="Home page, online" width="250"> | <img src="screenshots/pwa-offline-home.png" alt="Home page aperta senza rete: il pulsante di sincronizzazione mostra un'icona Wi-Fi barrata" width="250"> | <img src="screenshots/pwa-aggiornamento.png" alt="Icona di download nella barra in alto e avviso di nuova versione" width="250"> |
