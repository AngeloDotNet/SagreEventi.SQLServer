# Sicurezza (OWASP Top 10 / ASVS come riferimento)

> Richiede `core.md`. Le voci "API" e "Dati" valgono per progetti con backend; le voci "Frontend" per progetti Angular.
> **Livello ASVS:** il livello di OWASP ASVS cui il progetto tende (1, 2 o 3) si **chiede a ogni progetto**, senza default, e si registra nel `CLAUDE.md` (campo "Livello ASVS"). Le regole di questo file sono la base comune; un livello più alto può richiedere controlli in più, che Claude propone e non introduce di iniziativa.

## Autenticazione e Autorizzazione
- **Decisione sempre esplicita, mai implicita:** Claude NON aggiunge autenticazione/autorizzazione di sua iniziativa e NON presume la risposta dal progetto precedente. Per ogni progetto backend, se il `CLAUDE.md` non la specifica già, chiede in sequenza:
  1. **Il progetto richiede autenticazione/autorizzazione?** (Distinta dalla domanda dell'avvio, che riguarda solo l'inclusione di questo modulo: le altre regole del modulo, come CORS, header, segreti e upload, valgono anche senza login.) Se no, lo annota come assunzione e lo scrive nel `CLAUDE.md` (con avviso che gli endpoint sono pubblici).
  2. **Se sì, quale meccanismo?**
     - **ASP.NET Core Identity** (utenti nel database dell'applicazione), oppure
     - **Identity provider esterno self-hosted e gratuito** come **Keycloak** (Apache-2.0) o simili open source (verifica la licenza prima di proporli).
  3. **Se Identity, con quale granularità?** Chiedi esplicitamente e proponi le opzioni:
     - solo autenticazione (utente loggato sì/no);
     - ruoli (es. Admin, User);
     - policy basate su claim;
     - permessi granulari per risorsa/azione (assegnabili a ruoli o utenti);
     - extra da decidere uno per uno: registrazione self-service, conferma email, reset password, MFA/TOTP, login esterni (Google ecc.), lockout, multi-tenancy, gestione utenti da UI amministrativa.
  3b. **Se Identity e il progetto è solo API backend (senza frontend che usa cookie), servono anche token JWT?** Chiedi esplicitamente, non presumerlo. Se sì, chiedi **ogni volta** quale ciclo di vita implementare, senza presumere la risposta dal progetto precedente: solo creazione e verifica (access token a vita breve, nessuno stato lato server), oppure anche rinnovo (refresh token con rotazione) e revoca (refresh token e/o access token salvati o in denylist, logout, revoca dopo cambio password o ruolo). Spiega il compromesso: rinnovo e revoca richiedono uno stato lato server e più codice da mantenere. Definisci inoltre l'algoritmo di firma.
     - **Configurazione JWT:** durata dell'access token, durata del refresh token (se previsto) e la stringa/chiave di firma sono valori letti da `appsettings.json` (sezione `Jwt`, es. `Jwt:AccessTokenMinutes`, `Jwt:RefreshTokenDays`, `Jwt:Key`) tramite Options con `ValidateOnStart`; mai costanti nel codice. L'intera sezione `Jwt` è presente in `appsettings.json` ma con **dati fittizi/segnaposto** (es. chiave `CHANGE-ME-placeholder-not-a-real-key`, durate di esempio): mai valori reali nel file committato. I valori reali, chiave compresa, li forniscono in produzione le variabili d'ambiente (`Jwt__Key`, `Jwt__AccessTokenMinutes`, ecc.) o un `secret` Docker, che sovrascrivono il file (ordine di precedenza standard della configurazione ASP.NET Core); vanno elencati in `.env.example`. All'avvio la validazione fallisce se la chiave è ancora il segnaposto in un ambiente non di sviluppo. La chiave non è mai committata con un valore reale e rientra nella rotazione dei segreti (vedi "Dati e Segreti").
     - **Validazione e firma:** il middleware di autenticazione valida sempre firma, `iss`, `aud` e `exp`; issuer e audience arrivano dalla sezione `Jwt`; la tolleranza di orario (`ClockSkew`) è ridotta (non il default di 5 minuti), con valore in configurazione. Gli algoritmi accettati sono una lista esplicita (mai `none`): firma asimmetrica (es. ES256 o RS256) se più servizi verificano i token, HMAC (HS256) con chiave di almeno 256 bit solo per una singola API; l'algoritmo si concorda per progetto e va nel `CLAUDE.md`.
     - **Claim minimi:** nel token solo i claim necessari (identificativo utente, ruoli); mai dati personali o segreti, perché il payload è leggibile da chiunque.
  4. **Se provider esterno:** quale (Keycloak o altro), quali flussi (Authorization Code + PKCE per la SPA), come mappare ruoli e claim, dove gira (container nello stesso compose).
- La risposta va salvata nel `CLAUDE.md` di progetto (sezione "Scelte architetturali") così non si richiede a ogni compito dello stesso progetto; la domanda si ripete solo per un nuovo progetto o se cambiano i requisiti.
- **Servizi a pagamento o cloud proprietari esclusi, sempre:** niente Azure (Entra ID, Key Vault, B2C), AWS (Cognito, Secrets Manager), Auth0, Okta, Firebase Auth o simili. Sono esclusi anche **Duende IdentityServer** (licenza commerciale) e i tier a pagamento di prodotti open source. Se un requisito sembra richiederli, Claude lo segnala e propone l'alternativa gratuita self-hosted.
- Token di accesso sempre a vita breve. Il refresh token con rotazione si usa solo se nella domanda sul ciclo di vita JWT (punto 3b) è stato scelto il rinnovo; con la sola creazione e verifica non esiste. Per le SPA preferisci cookie `HttpOnly` + `Secure` + `SameSite` (o pattern BFF) al `localStorage`.
- **Attributi dei cookie di sessione e autenticazione:** `SameSite=Lax` di default (`Strict` se non servono link in ingresso da altri siti; `None` solo con motivazione, e richiede `Secure`); scadenza assoluta e di inattività definite e lette dalla configurazione, non dal codice; prima del consenso solo cookie strettamente tecnici (vedi `frontend.md` §6).
- Login non enumerante: messaggio generico ("credenziali non valide"), mai "utente inesistente" o "password errata". Stesso principio su reset password e registrazione.
- **Reset password, conferma email e sessioni (se Identity):**
  - La richiesta di reset risponde sempre con lo stesso messaggio e tempi simili, esista o no l'account.
  - I token di reset e di conferma sono generati dal framework (token provider di Identity), monouso e a scadenza breve (per il reset, ordine di un'ora); mai scritti nei log né riutilizzabili dopo l'uso.
  - Dopo un cambio o un reset della password (e dopo un cambio di ruolo) le sessioni e i refresh token esistenti sono invalidati (`SecurityStamp`, revoca dei token).
  - Il titolare dell'account riceve una email di avviso quando cambiano password o indirizzo email (invio secondo `backend-email.md`).
- Lockout temporaneo dopo tentativi falliti, policy password coerente con NIST (lunghezza prima della complessità, controllo su password compromesse). MFA (TOTP) per ruoli amministrativi e dove il progetto lo richiede.
- Endpoint protetti **di default** (`RequireAuthorization()` sul gruppo); `AllowAnonymous` solo come eccezione esplicita e motivata.
- Autorizzazione basata su policy/ruoli. Controlli di proprietà (anti-IDOR): ogni query filtra per utente o tenant.

## Protezione dell'API
- CORS con whitelist esplicita; mai `AllowAnyOrigin` insieme alle credenziali.
- Rate limiting (`AddRateLimiter`), più stretto su login e reset password.
- Security headers: CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`.
- CSP senza `unsafe-inline` né `unsafe-eval`: usa nonce generato per richiesta. Un nonce per richiesta richiede che `index.html` sia servito in modo dinamico (backend o proxy che lo inserisce); se l'SPA è servita come file statici (es. immagine unica con `config.json` a runtime, vedi `frontend.md`), Claude **chiede in ogni progetto** come realizzare la regola (server che inserisce il nonce, oppure hash degli inline noti) e annota la scelta nel `CLAUDE.md` (sezione "Note per Claude").
- HTTPS obbligatorio; antiforgery/CSRF se si usano cookie.
- **Dietro un reverse proxy** (caso normale, vedi `docker.md`): `UseForwardedHeaders` (`X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Host`) è il primo middleware della pipeline, altrimenti rate limiting, redirect HTTPS, HSTS e IP nei log vedono il proxy invece del client. I proxy fidati (`KnownProxies` / `KnownNetworks`) sono espliciti e letti dalla configurazione; mai header inoltrati accettati da qualunque origine (permetterebbe di falsificare l'IP del client). Quali proxy e reti sono fidati si chiede per progetto, perché l'host è gestito dall'utente.
- Limiti su dimensione del body e timeout delle richieste.
- Validazione server-side SEMPRE; il client non è mai considerato affidabile.
- **Ogni input esterno è non fidato, validato e sanificato:** anche header, query string, parametri di route, cookie e body; allow-list e limiti di lunghezza e formato, mai lista di divieti.
- **Health check (`/health/live`, `/health/ready`, vedi `core.md` §5):** le risposte contengono solo lo stato (Healthy/Unhealthy), mai nomi di dipendenze, versioni, stringhe di connessione o messaggi di errore; i dettagli vanno nei log. Dal proxy pubblico l'accesso a questi percorsi si limita a cura dell'utente (host e proxy sono suoi).

## Vulnerabilità applicative ricorrenti
- **OWASP Top 10 sempre:** Claude considera la sicurezza in ogni sviluppo e previene le vulnerabilità della Top 10 (injection, broken access control, ecc.), non solo quando la funzionalità è "di sicurezza".
- **Injection, tutte le forme:** SQL e NoSQL (query parametrizzate, mai input concatenato), command injection (mai input in `Process.Start` o shell), LDAP, XSS, header injection e log injection, path traversal, SSRF, deserializzazione non sicura.
- **SSRF:** mai chiamare un URL fornito dall'utente senza validazione. Allow-list di host e schemi (solo `https`), blocco di indirizzi privati, loopback e link-local (inclusi i metadati, es. `169.254.169.254`), redirect non seguiti alla cieca. Vale anche per webhook, import da URL e anteprime.
- **Open redirect:** i redirect (`returnUrl`, `redirect_uri`) accettano solo percorsi locali (`Url.IsLocalUrl` o equivalente) o URL in allow-list esplicita.
- **Mass assignment / overposting:** si deserializzano solo i `record` DTO di richiesta con i campi permessi; mai entità EF, mai campi come `Role`, `TenantId`, `IsAdmin` o `OwnerId` accettati dal client. Proprietà sensibili impostate dal server.
- **Deserializzazione:** solo `System.Text.Json` su tipi concreti attesi. Vietati `BinaryFormatter` e deserializzatori con tipi polimorfici scelti dal client (niente `$type` non vincolato).
- **Log injection e dati nei log:** i valori forniti dall'utente entrano nei log solo come parametri del template strutturato (`logger.LogInformation("Order {OrderId}", id)`), mai concatenati; i campi liberi vanno ripuliti da ritorni a capo. Nessun dato personale, token o segreto nei log.
- **Injection e path traversal:** query raw solo parametrizzate (vedi `backend.md`); nomi di file e percorsi dall'utente mai usati direttamente nel file system (nome rigenerato, percorso risolto e verificato dentro la cartella consentita).
- **Errori:** nessun stack trace, messaggio di eccezione, nome di tabella o versione in risposta fuori dall'ambiente Development (vedi `backend.md`, eccezioni globali).

## Crittografia
- **Solo API crittografiche moderne e non obsolete.** Vietati: MD5, SHA-1, DES/3DES, RC2, RC4, modalità ECB, `RijndaelManaged`, cifratura RSA con padding PKCS#1 v1.5, `Rfc2898DeriveBytes` con costruttori senza hash esplicito, `Random` per token, chiavi o segreti.
- **Consentiti:** AES-GCM, SHA-256/384/512, HMAC-SHA2, ECDSA ed RSA-PSS, PBKDF2 tramite `Rfc2898DeriveBytes.Pbkdf2` con hash esplicito, `RandomNumberGenerator` per ogni valore casuale sensibile.
- Gli analyzer di sicurezza di Roslyn segnalano gli usi vietati e fanno fallire la build. Un algoritmo proprio o una deroga si propongono con motivo e si attende l'approvazione dell'utente.
- **Confronti a tempo costante:** credenziali, token, hash e firme si confrontano con `CryptographicOperations.FixedTimeEquals`, mai con `==` o `string.Equals`.

## Dati e Segreti
- Data Protection di ASP.NET Core: con più container le chiavi sono persistite in un archivio condiviso (database o volume), altrimenti cookie e antiforgery token si invalidano tra repliche. Le chiavi persistite sono in chiaro per impostazione predefinita: se cifrarle a riposo e con quale meccanismo (es. un certificato come secret) si **chiede per progetto** e la scelta va nel `CLAUDE.md` (sezione "Note per Claude").
- Rotazione dei segreti: i segreti hanno una data di scadenza o rotazione dichiarata nel `CLAUDE.md` di progetto; un segreto compromesso o finito per errore nel repository si considera bruciato e va sostituito, non solo rimosso.
- Nessun segreto nel repository: User Secrets in sviluppo; in produzione `secrets` di Docker Compose, file esterni al repository o variabili d'ambiente (mai servizi cloud a pagamento come Azure Key Vault o AWS Secrets Manager).
- Password con l'hashing di ASP.NET Core Identity (`PasswordHasher` di default, PBKDF2 con iterazioni adeguate); Argon2 solo come deroga motivata e approvata. Con un IdP esterno l'hashing è quello dell'IdP. Mai in chiaro, né nei log.
- Upload: validazione di MIME e magic bytes, limite di dimensione, nomi rigenerati, storage fuori dalla webroot.
- Dati personali: minimizzazione, cifratura dei campi sensibili, retention e diritto all'oblio (GDPR).
- Dati di test: mai dati reali di produzione in sviluppo o test; usa dati sintetici o anonimizzati.
- Backup e ripristino: backup automatici del database con ripristino testato periodicamente. RPO/RTO e retention si dichiarano nel `CLAUDE.md` di progetto; gli artefatti di backup sono descritti in `docker.md`.
- Log di sicurezza: registra login riusciti e falliti, lockout, cambi di ruolo/permessi, accessi negati (401/403) e modifiche a dati critici, senza dati personali o segreti nel messaggio.

## Frontend
- Vietati `innerHTML` e `bypassSecurityTrust*` senza sanitizzazione e motivazione esplicita.
- Nessun dato sensibile in `localStorage`, URL o console.
- Nonce CSP in Angular: `CSP_NONCE` / attributo `ngCspNonce`.

## Supply chain
- Audit delle dipendenze, SAST, secret scanning, scansione immagini e SBOM: vedi `core.md` (§3 e §5).
- **Controllo licenze:** la regola "solo licenze permissive" (`core.md` §3) si verifica con uno strumento gratuito, non a memoria: per npm `license-checker-rseidelsohn` (BSD-3-Clause, versione 5.x; il progetto passerà a `@lizenz/checker`, oggi ancora pre-1.0: valutarlo quando esce la 1.0), per NuGet `nuget-license` di sensslen (Apache-2.0, dotnet tool `nuget-license`; non confonderlo con il vecchio `dotnet-project-licenses`, abbandonato). Licenze degli strumenti verificate il 2026-10-25; per qualunque altro strumento verifica la licenza prima di proporlo. Il comando e la lista di licenze ammesse stanno nel `CLAUDE.md` o nella CI; una licenza non ammessa o sconosciuta fa fallire il controllo e viene segnalata, non ignorata.

## Test di sicurezza automatici
Si scrivono nel progetto `IntegrationTests` (vedi `backend.md` §4.5) e fanno fallire la build; le voci su autenticazione e autorizzazione valgono solo se il progetto le prevede.
- **Endpoint protetti di default:** un test enumera gli endpoint e verifica che senza credenziali rispondano 401, tranne una lista esplicita di endpoint `AllowAnonymous` motivati; un nuovo endpoint pubblico fa fallire il test finché non viene dichiarato nella lista.
- **Ruoli e policy:** per ogni endpoint con ruolo o policy, un test con un utente senza il permesso (403) e uno con il permesso (successo).
- **Proprietà e tenant:** un secondo utente o tenant non raggiunge le risorse altrui (404, o 403 per deroga dichiarata): regola e test in `backend.md` §4.6.
- **Header e CORS:** un test verifica la presenza degli header di sicurezza sulle risposte e che CORS accetti solo le origini in whitelist.
- **Input malevoli (obbligatori per ogni modifica che tocca input, autenticazione o dati):** ogni endpoint o validatore nuovo o modificato ha test con payload ostili: frammenti SQL/XSS/path traversal nei campi, stringhe oltre i limiti, caratteri di controllo e a capo, JSON malformato o con tipi errati, overposting (campi non ammessi come `Role`, `OwnerId`, `TenantId`), identificatori di altri utenti. L'esito atteso è un rifiuto controllato (400, 404, 413 o 422 con `ProblemDetails`), mai un 500 né il dato elaborato. Gli unit test coprono i validatori, gli integration test l'endpoint.

## Regola operativa
- Se il codice richiesto introduce un rischio (es. disabilitare CORS o la validazione), Claude lo segnala prima di procedere.
- **Security review prima della consegna:** per ogni funzionalità che tocca autenticazione, autorizzazione, upload, URL esterni, query dinamiche o dati personali, Claude esegue la skill `/security-review` sulle modifiche e riporta i risultati nella consegna. Le modifiche solo cosmetiche o di documentazione ne sono escluse. Un problema trovato si corregge in un commit `fix(security)` a sé (vedi `git.md`) o si segnala all'utente se la correzione esula dal compito.
