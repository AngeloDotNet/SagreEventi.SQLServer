# Sviluppo

[← Torna al README](../README.md)

## Build e test

```bash
dotnet test
cd src/SagreEventi.Web
npm test            # unit test del client (Vitest)
npm run lint        # ESLint
npm run format:check # Prettier (controllo, non è imposto sul codice esistente)
npm run build
```

La build .NET tratta gli avvisi come errori (`TreatWarningsAsErrors`). Le versioni dei pacchetti NuGet sono centralizzate in `Directory.Packages.props` e i file `packages.lock.json` vanno committati: il Dockerfile dell'API fa il restore con `--locked-mode`, quindi dopo ogni aggiornamento di un pacchetto rigenera i lock file (`dotnet restore --force-evaluate`).

I test dell'API (xUnit, SQLite in memoria) coprono eventi, moderazione, utenti, login, limiti di frequenza, header inoltrati, CORS e input malevoli. I test del client (Vitest con jsdom, `*.spec.ts` accanto ai sorgenti in `src/app/core/`) coprono gli helper puri, l'esportazione `.ics`, l'accesso e il rinnovo del token, l'interceptor HTTP, lo store offline e la sua sincronizzazione, e i client HTTP; `npm run test:coverage` stampa un rapporto di copertura (informativo, nessuna soglia). La build di produzione del client è creata in `dist/sagre-eventi-web/browser`; servila con un qualsiasi host statico che per i percorsi sconosciuti ripieghi su `index.html`.

Controlla i pacchetti NuGet per vulnerabilità note:

```bash
dotnet list package --vulnerable --include-transitive
```

## Migrazioni del database

```bash
dotnet ef database update --project src/SagreEventi.Web.Server
```

Anche in produzione le migrazioni si applicano all'avvio del container del backend (`Database:MigraAllAvvio=true`), prima che l'API inizi a servire richieste. Con più repliche l'applicazione concorrente delle migrazioni va evitata: oggi l'app gira con una sola replica.
