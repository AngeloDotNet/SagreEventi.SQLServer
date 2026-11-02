# PLAN — Migrazione da xunit v2 a xunit.v3

Stato: da eseguire in un secondo momento (non urgente). Rilevato il 2026-11-01.

## Obiettivo
Sostituire `xunit` 2.9.3, deprecato su NuGet (motivo "Legacy", alternativa `xunit.v3`), nel progetto `tests/SagreEventi.Web.Server.Tests`.

## Assunzioni
- Non è una vulnerabilità (nessuna CVE): Visual Studio 2026 mostra la deprecazione in "Manage NuGet Packages for Solution".
- Deprecati anche i transitivi `xunit.assert`, `xunit.core`, `xunit.extensibility.core`, `xunit.extensibility.execution`.
- La migrazione richiede modifiche al progetto di test e possibili adattamenti dei test: lavoro su branch dedicato (`feature/` o `bugfix/` da `develop`, nome da confermare).

## Passi
- [ ] 1. Verificare versione corrente di `xunit.v3` e licenza (atteso Apache-2.0) con `nuget-license`, come da `CLAUDE.md`.
- [ ] 2. Sostituire `xunit` con `xunit.v3` e aggiornare `xunit.runner.visualstudio`; impostare `OutputType` Exe nel `.csproj` dei test.
- [ ] 3. Verificare compatibilità di `coverlet.collector` e `Microsoft.AspNetCore.Mvc.Testing`.
- [ ] 4. Adattare i test alle API cambiate (es. `IAsyncLifetime` con `ValueTask`, firme di `Assert`, fixture).
- [ ] 5. Build senza warning, test passati, `dotnet list package --deprecated` e `--vulnerable --include-transitive` puliti.
- [ ] 6. Voce in `CHANGELOG.md`.

## File coinvolti
- `tests/SagreEventi.Web.Server.Tests/SagreEventi.Web.Server.Tests.csproj`
- File di test che usano API cambiate (da individuare al passo 4)
- `CHANGELOG.md`

## Test previsti
La suite esistente deve restare verde con lo stesso numero di test; nessun test nuovo.

## Decisioni aperte
- ~~Nome del branch~~ deciso il 2026-11-01: `feature/xunit-v3` da `develop` (da riconfermare prima di crearlo, a lavoro avviato).
- Eventuale esclusione di `README.md` o `DEPLOY.md` se citano il comando dei test (da verificare al passo 4).

Ogni step richiede il "vai" esplicito.
