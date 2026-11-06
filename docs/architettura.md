# Architettura

[← Torna al README](../README.md)

| Progetto | Responsabilità |
| --- | --- |
| `src/SagreEventi.Shared` | Modelli condivisi (`EventoModel`, DTO di moderazione) |
| `src/SagreEventi.Web.Server` | Minimal API ASP.NET Core (.NET 10): endpoint, Identity, migrazioni EF Core, FusionCache, servizi in background (scadenza degli eventi e avviso email ai moderatori con MailKit) |
| `src/SagreEventi.Web` | Client Angular 21 (componenti standalone, signal, zoneless) con PrimeNG e un preset Aura personalizzato |
| `tests/SagreEventi.Web.Server.Tests` | Test di integrazione dell'API (xUnit, SQLite in memoria) |
| `src/SagreEventi.Web/src/app/core/*.spec.ts` | Unit test del client (Vitest, jsdom) |
| `deploy/docker-compose.yml`, `deploy/docker-compose.*.yml`, `deploy/sites-available` | Due container (Angular e API) dietro il nginx dell'host, da un compose unico o da due separati, vedi [Deployment](deployment.md) e [DEPLOY.md](../DEPLOY.md) |
| `.github/workflows/build-push.yml` | Compila e testa (API e client), poi pubblica le immagini API e Angular su Docker Hub (push su `main`) |

I componenti Angular tengono template, stili e classe in file separati (`x.component.ts`, `x.component.html` e `x.component.css` solo se il componente ha stili); le tre pagine di `features/eventi/` stanno ciascuna nella propria cartella.

## Perché questo stack

- **Un solo contratto, molti client:** l'API è un pugno di endpoint, quindi un nuovo client è questione di un fine settimana.
- **Offline-first:** gli eventi stanno in `localStorage` e un piccolo passo di sincronizzazione li riallinea con SQL Server.
- **Poche parti mobili nel client:** Angular, PrimeNG (tema e icone) e RxJS. Nessuna libreria di stato e nessun framework CSS.
- **Configurazione a runtime:** l'indirizzo dell'API è letto da `config.json`, quindi una sola build funziona in ogni ambiente.
