# Regole Git e Commit

> Richiede `core.md`. Si importa in ogni progetto versionato con git; `core.md` §5c rimanda a questo modulo.

**Ambito di Claude: solo commit locali, sempre con conferma esplicita.** Claude non committa mai di propria iniziativa, nemmeno un commit singolo: prima di ogni commit mostra file inclusi e messaggio proposto e **attende l'ok esplicito dell'utente**; senza ok, non committa. Dopo la conferma crea i commit (e, previa conferma dell'utente sul nome, il branch locale) seguendo queste linee guida, al termine di ogni unità logica di lavoro che builda e ha i test verdi. Oltre ai commit non esegue nessun'altra operazione git verso l'esterno o di integrazione (PR, merge request, merge, push, tag). Resta **a carico dell'utente**: `push`, creazione e merge delle PR, tag, rilasci e l'esecuzione delle pipeline CI/CD (i file di pipeline può scriverli e committarli Claude, vedi `core.md` §5). Claude non esegue mai queste operazioni, nemmeno se sembrano il passo naturale successivo: a fine lavoro segnala che i commit sono pronti per il push.

## Branch (git flow)
- **Modello:** git flow completo, **obbligatorio in ogni progetto**. `main` contiene solo codice rilasciato; `develop` è il branch di integrazione (il nome è sempre `develop`); il lavoro nasce su branch dedicati: `feature/` (nuove funzionalità), `bugfix/` (correzioni), `release/` (preparazione di un rilascio), che partono da `develop`, e `hotfix/` (correzione urgente su produzione), che parte da `main`. Non esiste un flusso semplificato senza `develop`: si deroga solo con approvazione esplicita dell'utente.
- **Se `develop` non esiste:** Claude non propone di partire da `main` e non lo aggira. Pone una sola domanda: se può creare `develop` da `main` (branch locale, solo dopo la conferma; `push` e collegamento al remoto restano all'utente). Ricevuta la risposta, propone il nome del branch di lavoro (per esempio `feature/nome-breve`) a partire da `develop` e chiede conferma, come da "Conferma del branch". Se il progetto ha un branch principale con altro nome (per esempio `master`) o un altro modello, Claude lo segnala e chiede se adottare `main` e `develop`, senza rinominare nulla di sua iniziativa.
- **Nomi:** `tipo/descrizione-breve` in minuscolo con trattini (`feature/order-export`, `bugfix/login-redirect`, `release/1.4.0`, `hotfix/1.4.1`). Se il lavoro è collegato a un ticket, il suo ID entra nel nome (`feature/ABC-123-order-export`). I commit dentro il branch usano i tipi Conventional Commits (`feat`, `fix`, ...), indipendenti dal nome del branch.
- **Conferma del branch, ogni volta:** prima di iniziare un lavoro e comunque prima del primo commit, Claude dice su quale branch si trova, propone tipo, nome e branch di partenza e **chiede conferma all'utente**. Vale anche se è già su un branch di lavoro (chiede se continuare lì). La conferma vale per quel lavoro, non per i successivi: a ogni nuovo lavoro si richiede.
- **Mai commit diretto su `main` o `develop`.** Un'eccezione esiste solo se l'utente la dichiara esplicitamente e vale per il caso o il progetto indicato, non diventa la regola generale.
- Claude crea il branch locale solo dopo la conferma. Non crea né cancella branch remoti e non esegue le chiusure di git flow (merge di `feature`, `release`, `hotfix` in `develop`/`main`, tag): sono a cura dell'utente, come push e PR.
- **Base avanzata o conflitti:** se Claude nota che il branch di partenza è avanzato, o che ci sono conflitti (per esempio dopo un'operazione dell'utente), lo segnala e non committa finché i conflitti non sono risolti. Può **proporre** come risolverli, mostrando le versioni a confronto e il motivo della scelta, ma applica la risoluzione solo dopo l'ok dell'utente; l'aggiornamento del branch (merge o rebase) resta a cura dell'utente.
- Branch di breve durata. Aggiornamento dal branch di partenza, push e merge (squash o rebase secondo la politica del progetto) sono a cura dell'utente. Con git flow la politica ha una regola fissa, vedi "Pull Request": squash solo per le PR verso `develop`, merge commit per ogni PR che coinvolge `main`.

## Messaggi di commit (Conventional Commits, in inglese)
- Formato: `tipo(scope): descrizione` — tipi ammessi: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`, `revert`.
- Oggetto all'imperativo, minuscolo, senza punto finale, al massimo 72 caratteri. `scope` opzionale (modulo o slice, es. `orders`, `auth`).
- Il corpo, se serve, spiega il **perché** e non il cosa, andando a capo a 100 caratteri circa.
- Breaking change: `!` dopo il tipo/scope (`feat(api)!: ...`) e footer `BREAKING CHANGE: ...`. Riferimenti ai ticket nel footer (`Refs: ABC-123`).
- **Il corpo è la norma, non l'eccezione**, per tutto ciò che non è banale: un breve paragrafo che spiega perché si cambia e quale problema risolve (causa radice per i `fix`), oppure un elenco puntato (`- `) degli interventi principali. Cita per nome tipi, metodi e file toccati.
- Riferimento a issue o PR nel corpo o nell'oggetto: `(issue #123)`, `(#456)`. Su `main` i commit di una PR in squash hanno il suffisso `(#NNN)`.
- **Bot delle dipendenze (Dependabot/Renovate):** quando Claude scrive la configurazione del bot, i commit e i titoli delle PR usano il prefisso `build(deps)` per le dipendenze di produzione e `chore(deps-dev)` per quelle di sviluppo, così restano conformi a Conventional Commits e al lint sulle PR verso `develop`.
- Mai messaggi generici (`Save uncommitted changes`, `wip`, `fix`, `update`): ogni commit dice cosa e perché. Unica eccezione, i commit WIP richiesti dall'utente (vedi "Repository, fine riga e hook").
- Trailer in fondo, dopo una riga vuota. Se è richiesta un'attribuzione a Claude: `Co-Authored-By: <modello> <noreply@anthropic.com>`; se la sessione ha un link, anche `Claude-Session: <url>`. Mai nell'oggetto.

## Granularità e sequenza
Una funzionalità non è un unico commit gigante: è una **serie di commit piccoli e ordinati sul branch**, ciascuno che builda e passa i test. Ordine tipico:
1. `feat(scope)`: modello/entità, configurazione EF e migrazione (+ servizio applicativo, se piccolo);
2. `feat(scope)`: endpoint o UI che usano il servizio;
3. `test(scope)`: test del servizio e dell'isolamento tra utenti; test di integrazione per ciò che gli unit test non coprono, nel progetto `IntegrationTests` con il database di prova (vedi `core.md` §4 e `backend.md` §4.5);
4. `docs(scope)` / `chore(...)`: aggiornamento di `README.md` e `CHANGELOG.md` (a ogni step del piano, vedi `core.md` §5b), ADR se servono.
- I **test stanno in commit `test(scope)` separati** dal codice di produzione, ma nella stessa PR; mai una PR con funzionalità senza test.
- Un `fix` è un commit a sé, con la causa radice nel corpo. Un bug di sicurezza usa `fix(security)`.
- Non mescolare refactoring, formattazione e cambi di comportamento nello stesso commit.
- Le chiavi di traduzione IT/EN viaggiano con la superficie UI che le usa (un commit per superficie va bene, come `extract orders surface strings`).
- Se un commit corregge il precedente della stessa serie e non è stato ancora pubblicato (nessun upstream che lo contiene), puoi fare `--amend` solo sull'ultimo commit creato da te in sessione; altrimenti crea un commit `fix` nuovo.

## Commit multipli: piano e passo-passo
Quando le modifiche da committare sono più di un'unità logica (o l'utente chiede "committa tutto"), Claude non crea i commit in blocco:
1. **Piano:** prima di creare qualsiasi commit, elenca i commit che intende fare, numerati e in ordine (vedi "Granularità e sequenza"): per ognuno oggetto proposto e file inclusi. Segnala i file che non rientrano in nessun commit (segreti, generati, estranei al lavoro). Segnala anche i file con **modifiche destinate a commit diversi**: `git add -p` è interattivo e non disponibile, quindi per quei file Claude **chiede caso per caso** se spezzarli (preparando una patch parziale applicata con `git apply --cached`, mostrata prima di committare) oppure unire i commit interessati; non sceglie da solo. Il piano si può correggere: l'utente può unire, dividere, riordinare o escludere commit. Il piano dei commit si salva in un file dedicato, **`piano-commit.md`** nella root del progetto (distinto da `PIANO.md`, che resta il piano di sviluppo): una casella di stato per commit, aggiornata dopo ognuno, così non si perde in un lavoro lungo o tra sessioni; come `PIANO.md`, non si committa se l'utente non lo chiede.
2. **Un commit alla volta:** dopo l'approvazione del piano crea **solo il commit n. 1** (file aggiunti per nome, `git status` e `git diff --staged` controllati, regole di messaggio e hook come sopra) e mostra hash e oggetto.
3. **Pausa e conferma:** dopo ogni commit si ferma e chiede se procedere con il successivo, indicando quale sarà (`n/N`, oggetto). Procede solo dopo il via dell'utente; se l'utente cambia idea sul piano, lo aggiorna e ripresenta l'elenco residuo.
4. **Nessun via anticipato:** l'approvazione del piano non vale come approvazione di tutti i commit, e il "sì" a un commit non vale per i successivi. Un'eccezione ("fai tutti i commit di fila") vale solo per quel piano, se l'utente la dichiara esplicitamente.
5. **Chiusura:** finiti i commit (o interrotti dall'utente) riepiloga quelli creati e quelli rimasti, e segnala che il `push` è a cura dell'utente. Poiché i commit sono stati confermati uno per volta, l'utente può fare `push` a lotti, anche intermedi, senza aspettare la fine della serie. Nel riepilogo (e nelle pause, se la serie è lunga) Claude **propone i punti sensati per un push intermedio**: dopo un gruppo di commit coerente (es. una funzionalità completa con i suoi test), con build e test verdi fino a lì. Resta una proposta: il push lo esegue l'utente.
6. **Se un commit fallisce** (hook, test rossi): corregge la causa, ricrea quel commit e ripresenta il punto del piano; non passa al successivo.

## Cosa non entra mai nel repository
- Segreti, `.env`, certificati, chiavi, dump di database, file generati (`bin`, `obj`, `node_modules`, `dist`) e file di IDE personali. Verifica `.gitignore` all'inizio del progetto.
- Prima di ogni commit controlla `git status` e `git diff --staged`: aggiungi i file per nome, mai `git add -A` alla cieca. Se compare qualcosa che sembra un segreto, fermati e segnalalo.
- **Controlli automatici sulle modifiche in stage:** `git diff --cached --check` (spazi finali, marcatori di conflitto, fine riga misti); `gitleaks` solo se è già installato sulla macchina (altrimenti lo dici, senza installarlo); segnala file aggiunti molto grandi o binari non attesi prima di committarli.
- I lock file (`packages.lock.json`, `package-lock.json`) vanno committati; i file di build no.

## Repository, fine riga e hook
- **Cartella non versionata:** se la cartella di lavoro non è un repository git, Claude **non esegue mai `git init`**, nemmeno se l'utente non lo vieta: si limita a **segnalare** che in quel progetto/soluzione git non è stato inizializzato e non committa. Claude non ha accesso diretto ai repository dei progetti ed è limitato ai soli commit locali; l'inizializzazione (e il collegamento a un remoto) è a cura dell'utente. Quando l'utente avrà inizializzato il repository, Claude riprende da lì.
- **Fine riga:** il repository ha un `.gitattributes` con `* text=auto` e `eol` esplicito per i file che lo richiedono (es. `*.sh text eol=lf`, `*.ps1 text eol=crlf`); `.editorconfig` coerente. Serve perché si lavora su Windows: senza, i diff si riempiono di cambi di fine riga. Se manca, Claude lo segnala e **valuta caso per caso** se proporlo: non lo dà per scontato e non lo crea né lo committa senza il tuo ok. Se l'utente conferma, il commit è `chore(repo)` a sé, e solo se il repository esiste (Claude non lo inizializza, vedi sopra). In un progetto esistente la modifica delle regole di fine riga può cambiare molti file: va valutata con l'utente prima di toccarli.
- **Hook pre-commit** (es. husky + lint-staged, o hook in `.githooks/`): sono parte del progetto. Claude può scriverli e committarli se richiesto; l'attivazione sulla macchina (`core.hooksPath`, `npm install`) è dell'utente. Se un hook fallisce durante un commit, Claude corregge la causa e ricrea il commit; mai `--no-verify`.
- **Commit con test rossi (WIP):** di norma ogni commit builda e passa i test. Un commit con build o test rossi è ammesso solo se l'utente lo chiede esplicitamente (es. per salvare un lavoro a metà); in tal caso oggetto `chore(wip): <cosa è in corso>`, corpo che indica cosa è rotto e perché, e nessun `--amend` o riscrittura successiva senza richiesta. La pulizia (squash) prima della PR è dell'utente.

## Sicurezza della cronologia
- Mai riscrivere cronologia che potrebbe essere già pubblicata (`rebase`, `reset`, `commit --amend` su commit non creati da te in sessione) senza conferma. Mai `push` di alcun tipo.
- Mai saltare gli hook (`--no-verify`) né la firma dei commit: se un hook fallisce, correggi la causa.
- Per annullare una modifica già pubblicata usa `git revert`, non `reset`.
- Se un segreto finisce in un commit, la rotazione del segreto viene prima di qualsiasi pulizia della cronologia.

## Pull Request (a cura dell'utente)
Claude non apre PR. Struttura i commit perché la PR sia pulita e, solo se l'utente lo chiede, redige titolo e descrizione da incollare.
- Una PR per issue o funzionalità, con titolo Conventional Commits; la serie di commit sul branch resta leggibile (nessun commit di "pulizia" in coda).
- La descrizione riporta: cosa cambia e perché, come è stato testato, impatti (migrazioni, variabili d'ambiente, breaking change), riferimento all'issue (`Closes #N`) e, per la UI, screenshot o note sui temi/lingue verificati.
- Il commit di merge (se il progetto non usa squash) ha oggetto `merge: <sintesi> (#NNN)` e un corpo che riassume l'insieme della funzionalità, con eventuali garanzie importanti (es. sicurezza, dati salvati, comportamento di default).
- La PR deve rispettare la checklist di consegna (`core.md` §0b) e avere la CI verde prima della richiesta di review.
- **Strategia di merge con git flow (a cura dell'utente):**
  - `feature/*` e `bugfix/*` verso `develop`: **squash**. Il titolo della PR diventa l'oggetto del commit, quindi segue Conventional Commits.
  - Ogni PR che coinvolge `main` (`develop` → `main`, `release/*` → `main`, `hotfix/*` → `main`) e il ritorno di `main` in `develop`: **merge commit**, mai squash né rebase. Lo squash scarta la storia dei commit: dopo uno squash di `develop` in `main` le due linee non hanno più un antenato comune aggiornato e la PR successiva va in conflitto (`add/add`) su tutti i file già portati.
  - Se `main` contiene commit che `develop` non ha (per esempio dopo un hotfix, o uno squash già avvenuto), prima di aprire la PR verso `main` si porta `main` in `develop` con un merge commit, risolvendo gli eventuali conflitti a favore di `develop` quando il contenuto di `main` è una versione più vecchia. Quel merge si fa su un branch dedicato (`bugfix/sync-main-into-develop`) con PR verso `develop` chiusa **con merge commit**: con lo squash il conflitto tornerebbe.
  - Il controllo dei commit della PR (lint Conventional Commits) si esegue solo sulle PR verso `develop`. Su una PR verso `main` l'intervallo contiene i commit di squash già in `develop`, il cui oggetto è stato controllato (o no) quando erano PR; rieseguirlo li farebbe fallire per motivi estranei alla PR.

## Rilascio
- Versionamento SemVer. La versione vive in un solo punto (es. `Directory.Build.props`) ed è accompagnata da una voce di rilascio in `CHANGELOG.md` (le voci dei singoli interventi sono già state scritte step by step).
- Il rilascio è un commit dedicato e isolato dalle funzionalità: `chore(release): bump version to X.Y.Z`, con corpo a elenco (file di versione aggiornato, voce di rilascio aggiunta al changelog, fix inclusi). Per un fix urgente può essere nell'oggetto: `fix(scope): ... and release vX.Y.Z`.
- Claude prepara solo il commit di bump (e solo se l'utente chiede un rilascio). Tag, pubblicazione e pipeline di release sono dell'utente.

## Esempi di riferimento
```
feat(outputs): add OutputShareLink entity and service for read-only share links

Adds the domain entity, EF configuration, migration and application service
for issue #319: a per-output, opt-in, revocable token ...

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```
```
test(outputs): cover OutputShareLinkService lifecycle and cross-user isolation

Exercises enable/regenerate/revoke, expiry, garbage-token handling, and that
resolution and management never cross user boundaries.
```
```
fix(security): restore antiforgery middleware ordering after authentication

<causa radice: cosa succedeva, perché, e come lo si è corretto>
```
```
chore(release): bump version to 7.1.3

- Update version prefix in Directory.Build.props
- Add the 7.1.3 release entry to CHANGELOG
```
