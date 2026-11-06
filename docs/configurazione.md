# Configurazione

[← Torna al README](../README.md)

Le impostazioni possono essere date anche come variabili d'ambiente, con `__` come separatore (`Identity__Admin__Email`).

| Impostazione | Descrizione |
| --- | --- |
| `ConnectionStrings:Default` | Stringa di connessione a SQL Server |
| `Identity:Admin`, `Identity:Editor` | Email e password degli utenti creati all'avvio |
| `Identity:RegistrazionePubblica` | `true` riattiva la registrazione pubblica (disattivata di default) |
| `Database:MigraAllAvvio` | Applica le migrazioni all'avvio |
| `Eventi:MaxPerRichiesta`, `Eventi:RichiestePutAlMinuto` | Limiti di scrittura anonima: eventi per `PUT` (20) e richieste `PUT` al minuto per IP (10) |
| `Altcha:HmacKey` | Segreto che firma le challenge anti-bot (min. 32 caratteri; obbligatorio fuori da Development, mai nel repository) |
| `Altcha:MaxNumber`, `Altcha:ChallengeValidityMinutes` | Difficoltà (300000) e validità in minuti (10) della challenge |
| `Smtp:Host`, `Smtp:Port`, `Smtp:Security` | Server SMTP per le email ai moderatori (porta 587 e `Auto` di default; obbligatorio fuori da Development, l'API non parte con il segnaposto). `Smtp:Security`: `Auto`, `None`, `StartTls`, `SslOnConnect`, `StartTlsWhenAvailable`; `None` (senza TLS) e `StartTlsWhenAvailable` (può ripiegare sul testo in chiaro) sono accettati solo in Development, per un SMTP locale di prova; altrove l'API non parte. Se questo divieto crea problemi con il tuo provider di posta, apri una issue: verrà gestita con uno sviluppo ad hoc, senza allentare la regola a mano |
| `Smtp:Username`, `Smtp:Password`, `Smtp:Sender` | Credenziali (opzionali, ma insieme; mai nel repository) e mittente (`Nome <indirizzo>`) |
| `Moderazione:AvvisoIntervalloMinuti` | Minuti tra due avvisi ai moderatori (60 di default, minimo 5; si applica anche a runtime) |
| `App:PublicBaseUrl` | Indirizzo pubblico dell'app (`https`, senza credenziali né query): base dei link nelle email; obbligatorio fuori da Development |
| `Eventi:RichiesteChallengeAlMinuto` | Richieste `GetChallenge` al minuto per IP (30) |
| `Eventi:RichiesteStatiAlMinuto` | Richieste `GetStati` al minuto per IP (30) |
| `Eventi:ScadenzaIntervalloMinuti` | Minuti tra due esecuzioni della scadenza automatica (60 di default) |
| `Kestrel:Limits:MaxRequestBodySize` | Dimensione massima della richiesta (5 MB di default) |
| `Cors:Origins` | Origini ammesse del client Angular (`http://localhost:4200` di default) |
| `ForwardedHeaders:KnownProxies`, `ForwardedHeaders:KnownNetworks` | Reverse proxy fidati per `X-Forwarded-For` e `X-Forwarded-Proto`. Senza di essi gli header sono ignorati |
| `AllowedHosts` | Valori di `Host` accettati (in Docker, il nome host pubblico) |
| `apiBaseUrl` (`public/config.json`) | URL di base dell'API per il client Angular. Vuoto significa stessa origine |

L'autenticazione usa token bearer (nessun cookie). Dietro un reverse proxy i limiti di frequenza per IP richiedono `ForwardedHeaders`, altrimenti tutti gli utenti condividono un solo limite.
