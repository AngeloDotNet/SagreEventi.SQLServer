# Protezione anti-bot

[← Torna al README](../README.md)

L'invio delle segnalazioni è protetto da una prova di lavoro (proof of work, protocollo ALTCHA v1, implementato senza librerie esterne). Prima di ogni `PUT /api/Eventi/UpdateEventi` il client chiede una challenge a `GET /api/Eventi/GetChallenge`, trova il numero segreto in un Web Worker (di solito qualche secondo, senza bloccare l'interfaccia) e invia la soluzione nell'header `X-Altcha`. Il server verifica firma HMAC, scadenza e soluzione e rifiuta il riuso della stessa prova. La verifica avviene al momento della sincronizzazione, quindi una segnalazione scritta offline resta in coda e viene inviata appena c'è rete.

È un freno, non un blocco: rende costoso l'invio massivo e lavora insieme al limite di frequenza per IP. Il segreto di firma `Altcha:HmacKey` è obbligatorio fuori da Development (l'API non parte con il segnaposto); l'anti-replay è in memoria e vale per singola istanza.

Le impostazioni (`Altcha:*`) sono in [Configurazione](configurazione.md).
