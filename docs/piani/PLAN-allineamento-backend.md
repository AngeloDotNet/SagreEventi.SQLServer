# PLAN — Allineamento del backend ai MUST di `backend.md`

## Obiettivo
Portare `src/SagreEventi.Web.Server` a rispettare i MUST di `backend.md` §2 oggi non rispettati: punti 36 (`Interfaces/`), 39 (`Validators/`), 41 (`Requests/` e `Responses/`), più la verifica dei punti 37 (expression body) e 38 (using inutilizzati). Solo spostamenti e rinomine: nessun cambio di comportamento.

## Assunzioni
- Decisione dell'utente: piano di allineamento, non deroga «solo codice nuovo».
- Il progetto resta un solo progetto (la Clean Architecture è un'attività separata): le cartelle `Interfaces/`, `Validators/`, `Requests/`, `Responses/` stanno alla radice di `SagreEventi.Web.Server`.
- I namespace seguono le cartelle; vanno aggiornati anche i test che li referenziano.
- Ogni step richiede build senza warning e test verdi prima di essere spuntato; poi attende il «vai» dell'utente.
- Nessun commit senza conferma esplicita (`piano-commit.md` aggiornato su richiesta).

## Passi
- [ ] 1. **Baseline:** build e test sul codice attuale, per distinguere eventuali rossi preesistenti dai nuovi.
- [ ] 2. **Punto 36:** creare `Interfaces/` e spostarvi `IEventiService`, `IAltchaService`, `IEmailSender` (oggi in `Models/Services/Application/`); aggiornare namespace, `using`, registrazioni DI e test.
- [ ] 3. **Punto 39:** rinominare `Validation/` in `Validators/` (`EventoValidator.cs`); aggiornare namespace e riferimenti.
- [ ] 4. **Punto 41:** creare `Requests/` e `Responses/`; estrarre `CreaUtenteRequest`, `ModificaUtenteRequest` (da `AdminUtentiEndpoints.cs`) in `Requests/`, e `UtenteAdminModel`, `UtenteCorrenteResponse` (da `AdminUtentiEndpoints.cs` e `IdentityServices.cs`) in `Responses/`; un tipo per file. Da decidere in quel passo: dove vanno `EventoModel` e gli altri modelli già esistenti, se sono DTO.
- [ ] 5. **Punto 37:** verificare i metodi con corpo a singola espressione e convertirli in `=>`, a partire dagli endpoint.
- [ ] 6. **Punto 38:** `dotnet format style --diagnostics IDE0005` dopo una build pulita, poi nuova build.
- [ ] 7. `CHANGELOG.md` (una voce per step completato) e aggiornamento di `README.md` se descrive la struttura delle cartelle.

## File coinvolti
`Models/Services/Application/I*.cs`, `Validation/EventoValidator.cs`, `Endpoints/AdminUtentiEndpoints.cs`, `Extensions/IdentityServices.cs`, `Extensions/ServiceCollectionExtensions.cs`, i file che usano i namespace spostati, il progetto di test, `CHANGELOG.md`, `README.md`.

## Test previsti
Nessun test nuovo: il comportamento non cambia. Si usano i test esistenti come rete di sicurezza (build senza warning, tutti verdi) dopo ogni step.

## Decisioni aperte
- Destino di `EventoModel` e degli altri modelli esistenti (passo 4).
- Ordine rispetto agli altri piani aperti (`PLAN-aggiornamento-nuget.md`, `PLAN-failsafe-cache.md`, `PLAN-xunit-v3.md`): evitare conflitti sugli stessi file.
