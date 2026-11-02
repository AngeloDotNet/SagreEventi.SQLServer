# PLAN — Persistenza delle chiavi di Data Protection su database

## Obiettivo
Far sopravvivere ai riavvii del container (deploy) i token bearer e i refresh token di `AddIdentityApiEndpoints`, che sono protetti con le chiavi di ASP.NET Core Data Protection. Oggi le chiavi non sono persistite: a ogni deploy tutti gli utenti perdono la sessione.

## Assunzioni
- Decisione dell'utente: le chiavi stanno nel **database** (stesso SQL Server dell'app), non su un volume Docker.
- Chiavi **in chiaro** a riposo, come già deciso nel `CLAUDE.md` («nessuna cifratura a riposo»).
- La soluzione abilita anche più repliche in futuro (chiavi condivise), ma questo piano non cambia il numero di repliche.
- Pacchetto previsto: `Microsoft.AspNetCore.DataProtection.EntityFrameworkCore` (versione allineata a .NET 10, licenza da verificare su NuGet e sul repository ufficiale al primo uso, come da `core.md` §3). Da dichiarare con nome, versione e motivo prima di installarlo.
- Tabella `DataProtectionKeys` creata da una migrazione EF Core (mai `EnsureCreated`, mai migrazioni applicate all'avvio in produzione: segue il flusso di migrazione già in uso nel progetto).
- Nome dell'applicazione (`SetApplicationName`) fissato, così le chiavi restano valide se cambia il percorso di installazione.

## Passi
- [ ] 1. Verifica pacchetto: versione, licenza, compatibilità con net10.0; `dotnet list package --vulnerable --include-transitive`.
- [ ] 2. `AppDbContext` implementa `IDataProtectionKeyContext` (`DbSet<DataProtectionKey>`); configurazione registrata in `ServiceCollectionExtensions.cs` / `IdentityServices.cs` con `AddDataProtection().SetApplicationName(...).PersistKeysToDbContext<AppDbContext>()`.
- [ ] 3. Migrazione EF per la tabella delle chiavi; controllo dello script e della compatibilità con il flusso di migrazione del deploy (`DEPLOY.md`).
- [ ] 4. Test: integration test su database di prova che verifica (a) la chiave viene salvata nel database, (b) un token emesso da un'istanza dell'host è valido su una seconda istanza che condivide lo stesso database (riavvio simulato). Test di sicurezza: la tabella non è raggiungibile da endpoint, nessuna chiave nei log.
- [ ] 5. Documentazione: `README.md` e `DEPLOY.md` (le sessioni sopravvivono ai deploy; la tabella contiene materiale sensibile e va inclusa nel backup e protetta come il resto del database), `CLAUDE.md` (aggiornare la nota «Data Protection»), `CHANGELOG.md`.
- [ ] 6. Security review (`/security-review`): la modifica tocca autenticazione e segreti.

## File coinvolti
`SagreEventi.Web.Server.csproj`, `Models/Services/Infrastructure/AppDbContext.cs`, `Extensions/ServiceCollectionExtensions.cs` o `IdentityServices.cs`, nuova migrazione e `AppDbContextModelSnapshot.cs`, progetto di test, `README.md`, `DEPLOY.md`, `CLAUDE.md`, `CHANGELOG.md`.

## Test previsti
Integration test su database reale di prova (`backend.md` §4.5): persistenza e condivisione tra due istanze. Test esistenti come rete di sicurezza.

## Decisioni aperte
- Se le chiavi in chiaro nel database siano accettabili con ASVS livello 2 (la scelta precedente era per le chiavi su file; con il database valgono gli stessi accessi dell'utente applicativo): da riconfermare allo step 2.
- Eventuale pulizia delle chiavi scadute (Data Protection le ruota ogni 90 giorni di default, le vecchie restano per decifrare): nessuna azione prevista.
- Ordine rispetto agli altri piani aperti che toccano `AppDbContext` e le migrazioni (`PLAN-aggiornamento-nuget.md`, `PLAN-failsafe-cache.md`).
