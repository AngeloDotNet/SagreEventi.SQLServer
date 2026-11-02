# PLAN — Aggiornamento pacchetti NuGet del server

Stato: da eseguire in un secondo momento (non urgente). Rilevato il 2026-11-01.

## Obiettivo
Portare a 10.0.14 i pacchetti NuGet obsoleti di `SagreEventi.Web.Server` (solo aggiornamenti di patch, stessa famiglia .NET 10).

## Assunzioni
- Nessuna modifica di codice né migrazione EF necessaria (patch release).
- Feed in uso: nuget.org e `nuget.aepserver.it`.
- Nessuna vulnerabilità nota oggi (`dotnet list package --vulnerable --include-transitive` pulito).

## Pacchetti (10.0.13 → 10.0.14)
- `Microsoft.AspNetCore.Identity.EntityFrameworkCore`
- `Microsoft.AspNetCore.OpenApi`
- `Microsoft.EntityFrameworkCore.SqlServer`
- `Microsoft.EntityFrameworkCore.Tools`
- `System.Security.Cryptography.Pkcs`

## Passi
- [ ] 1. Rieseguire `dotnet list package --outdated` (le versioni possono essere cambiate) e aggiornare i pacchetti nel `.csproj` / `Directory.Packages.props` se presente.
- [ ] 2. Build senza warning, test passati, `dotnet list package --vulnerable --include-transitive` pulito.
- [ ] 3. Voce in `CHANGELOG.md`.

## File coinvolti
- `src/SagreEventi.Web.Server/SagreEventi.Web.Server.csproj` (o file centrale delle versioni, se usato)
- `CHANGELOG.md`

## Test previsti
Suite esistente (`SagreEventi.Web.Server.Tests`); nessun test nuovo.

## Decisioni aperte
Nessuna. Ogni step richiede il "vai" esplicito.
