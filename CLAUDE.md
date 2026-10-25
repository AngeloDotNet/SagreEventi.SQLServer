# Istruzioni per Claude

- All'inizio di un lavoro leggi `CHANGES.md`: riassume le modifiche passate e il contesto, evita di rileggere il codice già noto.
- Dopo ogni modifica al codice aggiungi in cima a `CHANGES.md` una voce breve (data, perché, file toccati, note/da fare).
- Non fare mai commit delle modifiche
- Quando esiste un plan di attività, svolgere gli step uno alla volta e attendere la conferma esplicita dell'utente prima di ogni modifica. Approvare il plan non equivale a dare il via a tutti gli step: dopo l'approvazione proporre lo step successivo e aspettare il "vai".
- Al termine di ogni step, se la build termina correttamente, registrare le modifiche in `CHANGES.md`.
- Quando si crea un piano (plan), salvarlo in un file `.md` dedicato nella root del repository (es. `PLAN-<nome>.md`), così che sia tracciato nel repository.

## Generale
- Definire il plan e salvarlo in un file `.md`
- Il plan va seguito step by step: ogni step richiede un OK esplicito prima di procedere
- **Non eseguire mai commit**
- Aggiungere commenti in inglese ai metodi pubblici, se presenti nel codice in italiano o totalmente assenti, aggiungere i commenti in inglese corrispondenti.

## Qualità del codice
- Seguire i principi SOLID
- Seguire le convenzioni di codifica e gli standard del progetto, inclusi i naming convention, la formattazione, le regole di stile e le best practice del linguaggio utilizzato
- Manutenibile e leggibile
- Nullable reference types abilitati
- Evitare astrazioni non necessarie e overengineering
- Privilegiare la semplicità ogni volta che è possibile
- Scrivere codice testabile e coperto da test automatizzati (unit test e integration test)

## Sicurezza
- Considerare sempre la sicurezza: prevenire le vulnerabilità OWASP Top 10 (injection, broken access control, ecc.)
- Proteggere da injection: SQL/NoSQL (query parametrizzate, mai concatenare input), command, LDAP, XSS, header/log injection, path traversal, SSRF, deserializzazione non sicura
- Validare e sanificare ogni input esterno (anche header, query string, route, body)
- Mai esporre dettagli interni (stack trace, messaggi di eccezione) nelle risposte fuori da Development
- Nessun segreto o credenziale nel codice o nei log; confronti di credenziali a tempo costante
- Usare solo API crittografiche moderne e non obsolete
- Tenere i pacchetti NuGet privi di vulnerabilità note (`dotnet list package --vulnerable --include-transitive`)
- Ogni modifica che tocca input, autenticazione o dati va verificata con test di sicurezza (es. input malevoli)