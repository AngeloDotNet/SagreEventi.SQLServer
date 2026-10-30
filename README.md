<div align="center">
    
# Food and wine festivals and events <br />

**A place to keep track of food and wine festivals, reported by the people who go to them.** 

[Overview](#overview) | [Features](#features) | [Architecture](#architecture) | [Getting started](#getting-started) | [Development](#development) | [Deployment](#deployment)

<img width="1000" height="420" alt="sagreeventi-devto-cover" src="https://github.com/user-attachments/assets/60d19983-03f0-4d17-ab83-32194877d1f6" /></div>

## Overview

SagreEventi (*sagre ed eventi enogastronomici*) is a web application to browse, report and manage food and wine festivals. Anyone can report an event and browse what is on, without an account. Editing existing events is reserved to users with the `Admin` or `Editor` role.

The solution has one ASP.NET Core API (API only, no hosted UI) and an Angular + PrimeNG client that talks to it. Two Docker containers (API and Angular) run behind the nginx of the host. The app does **not** sell tickets or take bookings.

<!--
> [!NOTE]
> The original Blazor WebAssembly client has been removed. Angular is pinned to version 21 on purpose: PrimeNG 21.1.x is the latest PrimeNG release published under the MIT license, while PrimeNG 22 introduces a license key. Check PrimeTek's current terms before upgrading.
-->
> [!NOTE]
> Angular is pinned to version 21 on purpose: PrimeNG 21.1.x is the latest PrimeNG release published under the MIT license, while PrimeNG 22 introduces a license key. Check PrimeTek's current terms before upgrading.

## Features

- **Browse events:** a home page with the next events hanging from a festival bunting, a searchable catalog and a month-by-month agenda.
- **Filter and sort:** by free text (accent-insensitive), city and period (in progress, upcoming, finished), and by date, name or city, in a grid or list view.
- **Report an event:** a validated form with date pickers and city suggestions. A report from an anonymous user stays hidden from everyone else until it is approved; the reporter sees it as *pending* under «Le mie» on their own device.
- **Review reports:** `Admin` and `Editor` approve or reject reports in bulk at `/gestione/revisione`, and can withdraw an event that was already approved. Events reported by `Admin` or `Editor` are published straight away.
- **Manage users:** `Admin` creates, edits (email, password reset, roles) and deletes users at `/gestione/utenti`. The last `Admin` cannot be removed.
- **Edit events:** only after signing in as `Admin` or `Editor`. Anonymous edits of existing events are rejected by the API (`403`).
- **Automatic conclusion:** the server concludes an event once its end date has passed. A concluded event can no longer be edited by anyone, and the API has no delete.
- **Take it with you:** add an event to your calendar (`.ics`), open its city on a map, share it.
- **Work offline:** everything you see is stored on the device and syncs when the connection is back.
- **Installable (PWA):** add it to the home screen of a phone or install it on a desktop; the app opens even with no network, and a new version is announced in the top bar.
- **Accessible UI:** Italian interface, light and dark theme, keyboard and screen-reader friendly, responsive down to a phone.

## Architecture

| Project | Responsibility |
|---|---|
| `src/SagreEventi.Shared` | Shared models (`EventoModel`, moderation DTOs) |
| `src/SagreEventi.Web.Server` | ASP.NET Core (.NET 10) Minimal API: endpoints, Identity, EF Core migrations, FusionCache, hosted service that expires events |
| `src/SagreEventi.Web` | Angular 21 client (standalone components, signals, zoneless) with PrimeNG and a custom Aura preset |
| `tests/SagreEventi.Web.Server.Tests` | API integration tests (xUnit, in-memory SQLite) |
| `src/SagreEventi.Web/src/app/core/*.spec.ts` | Client unit tests (Vitest, jsdom) |
| `deploy/docker-compose.*.yml`, `deploy/sites-available` | Two independent containers (Angular and API) behind the host nginx, see [DEPLOY.md](DEPLOY.md) |
| `.github/workflows/build-push.yml` | Builds and tests (API and client), then publishes the API and Angular images on Docker Hub (push to `main`) |

The Angular components keep template, styles and class in separate files (`x.component.ts`, `x.component.html`, and `x.component.css` only when the component has styles); the three pages of `features/eventi/` each live in their own folder.

Why this stack:

- **One contract, many clients:** the API is a handful of endpoints, so a new client is a weekend of work.
- **Offline-first:** events live in `localStorage` and a small sync step reconciles them with SQL Server.
- **Few moving parts in the client:** Angular, PrimeNG (theme and icons) and RxJS. No state library and no CSS framework.
- **Runtime configuration:** the API address is read from `config.json`, so one build runs in every environment.

### Moderation

Events have three states: `InAttesa` (default for anonymous reports), `Approvato` and `Rifiutato`. Only approved events are returned by `GetEventi`, and the server never trusts a state sent by a client. A rejected event is kept with an optional note, visible only to `Admin` and `Editor`: the reporter is told nothing and still sees it as pending. Withdrawing an approved event turns it into a rejected, concluded one, which clients use to delete their local copy at the next sync.

### Offline-first sync

The Angular client keeps its own copy of the events and syncs with the API in three steps:

1. **Push:** events created or edited on the device are sent with `PUT /api/Eventi/UpdateEventi`.
2. **Pull:** changes made by others are fetched with `GET /api/Eventi/GetEventi?since=<cursor>`.
3. **Merge:** server data replaces local data unless the local copy is pending and newer. Concluded events are removed.

A sync runs at start-up, when the browser comes back online, and when you press the sync button in the top bar.

### Progressive web app

The client is an installable PWA (web manifest, icons, Angular service worker). The service worker caches only the application files, **not** the `/api` calls: data stays in the offline-first store described above, so there is a single source of truth on the device.

- **Offline:** pages already visited, and the app shell, open with no network. The sync button turns into a crossed-out Wi-Fi icon, and a red toast tells you when a page that was never opened cannot be loaded.
- **Updates:** the browser downloads a new version in the background. When it is ready a download icon appears in the top bar (with a short toast); clicking it reloads the app. Nothing reloads by itself, so a form you are filling is never lost.
- **Production only:** the service worker is disabled under `ng serve`. To try it, serve the production build (`ng build`, then any static server) on `localhost` or over HTTPS.
- **Hosting:** `ngsw.json` and `ngsw-worker.js` must never be served with a long HTTP cache; see [DEPLOY.md](DEPLOY.md#pwa-installazione-offline-e-aggiornamenti).

| Online | Offline | New version ready |
|---|---|---|
| <img src="docs/screenshots/pwa-online-home.png" alt="Home page, online" width="250"> | <img src="docs/screenshots/pwa-offline-home.png" alt="Home page opened with no network: the sync button shows a crossed-out Wi-Fi icon" width="250"> | <img src="docs/screenshots/pwa-aggiornamento.png" alt="Download icon in the top bar and the new-version toast" width="250"> |

### API

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/Eventi/GetEventi?since={datetime}` | GET | Events modified after `since` |
| `/api/Eventi/UpdateEventi` | PUT | Inserts new events (anonymous, max 20 per request, rate limited per IP). Updates existing ones only with an `Admin`/`Editor` token |
| `/api/Eventi/GetStati?ids=...` | GET | State of the events you reported (max 50 ids). A rejected event is reported as `InAttesa` |
| `/api/Eventi/Revisione/*` | GET, POST | Review queue, approve, reject and concluded events; `Admin`/`Editor` only (`Conclusi` is `Admin` only) |
| `/api/admin/utenti`, `/api/admin/ruoli` | GET, POST, PUT, DELETE | User management, `Admin` only |
| `/api/auth/login`, `/api/auth/refresh`, `/api/auth/me` | POST, GET | Bearer and refresh tokens, current user. Registration is disabled |
| `/healthz` | GET | Liveness probe used by Docker, not routed by the nginx proxy |

The server sets `dataOraUltimaModifica` itself on every write; the value sent by the client is only used to decide which version is newer. The OpenAPI document is at `/openapi/v1.json` in Development.

An event looks like this (JSON, camelCase):

```json
{
  "id": "0b1e9e8e-5c0f-4a5e-8d0e-6b1a2f6c9a11",
  "nomeEvento": "Sagra della castagna",
  "cittaEvento": "Soriano nel Cimino",
  "dataInizioEvento": "2026-10-24T00:00:00",
  "dataFineEvento": "2026-10-26T00:00:00",
  "descrizioneEvento": "Caldarroste, vino novello e musica dal vivo.",
  "eventoConcluso": false,
  "dataOraUltimaModifica": "2026-10-22T18:30:00.000Z",
  "stato": "Approvato"
}
```

`stato` is output only. Text fields have maximum lengths (id 100, name 200, city 100, description 4000); longer values get `400`.

## Getting started

### Prerequisites

- .NET 10 SDK
- A SQL Server instance
- Node.js `^20.19`, `^22.12` or `^24` for the Angular client
- Docker with Compose v2, only to deploy (see [DEPLOY.md](DEPLOY.md))

### Configure the API

Clone the project:

```bash
git clone https://github.com/AngeloDotNet/SagreEventi.SQLServer.git
cd SagreEventi.SQLServer
```

Put your secrets in `src/SagreEventi.Web.Server/appsettings.local.json`. It is git-ignored and loaded after `appsettings.json`:

```json
{
  "ConnectionStrings": { "Default": "Data Source=...;Initial Catalog=SagreEventi;User ID=...;Password=...;Encrypt=False" },
  "Identity": {
    "Admin": { "Email": "you@example.com", "Password": "a-strong-password" },
    "Editor": { "Email": "editor@example.com", "Password": "another-strong-password" }
  }
}
```

### Run locally

Start the API:

```bash
cd src/SagreEventi.Web.Server
dotnet run
```

The API listens on `https://localhost:5001` and `http://localhost:5000`. At start-up it applies the EF Core migrations (`Database:MigraAllAvvio`, SQL Server only), creates the `Admin` and `Editor` roles and the users configured in `Identity:Admin` and `Identity:Editor`. Public self-registration is disabled.

Start the Angular client in a second terminal:

```bash
cd src/SagreEventi.Web
npm install
npm start
```

Open `http://localhost:4200`. In development, requests to `/api` are proxied to `https://localhost:5001` (see `proxy.conf.json`).

> [!WARNING]
> The defaults in `appsettings.json` are fake (`admin@sagreeventi.local`, `editor@sagreeventi.local`). Change them before any deploy. After upgrading an existing database every event is `InAttesa`: sign in as `Admin` or `Editor`, open `/gestione/revisione` and approve the existing events (up to 100 per round).

## Development

### Build and test

```bash
dotnet test
cd src/SagreEventi.Web
npm test            # client unit tests (Vitest)
npm run build
```

The API tests (xUnit, in-memory SQLite) cover events, moderation, users, login, rate limits, forwarded headers, CORS and malicious input. The client tests (Vitest with jsdom, `*.spec.ts` next to the sources in `src/app/core/`) cover the pure helpers, the `.ics` export, sign-in and token renewal, the HTTP interceptor, the offline store and its synchronisation, and the HTTP clients; `npm run test:coverage` prints a coverage report (informative, no threshold). The production build of the client is created in `dist/sagre-eventi-web/browser`; serve it with any static host that falls back to `index.html` for unknown paths.

Check the NuGet packages for known vulnerabilities:

```bash
dotnet list package --vulnerable --include-transitive
```

### Database migrations

```bash
dotnet ef database update --project src/SagreEventi.Web.Server
```

Consider turning `Database:MigraAllAvvio` off in production and running migrations explicitly.

### Configuration

Settings can also be given as environment variables, with `__` as the separator (`Identity__Admin__Email`).

| Setting | Description |
|---|---|
| `ConnectionStrings:Default` | SQL Server connection string |
| `Identity:Admin`, `Identity:Editor` | Email and password of the users created at start-up |
| `Identity:RegistrazionePubblica` | `true` re-enables public registration (off by default) |
| `Database:MigraAllAvvio` | Apply migrations at start-up |
| `Eventi:MaxPerRichiesta`, `Eventi:RichiestePutAlMinuto` | Anonymous write limits: events per `PUT` (20) and `PUT` requests per minute per IP (10) |
| `Eventi:RichiesteStatiAlMinuto` | `GetStati` requests per minute per IP (30) |
| `Eventi:ScadenzaIntervalloMinuti` | Minutes between two runs of the automatic expiry (60 by default) |
| `Kestrel:Limits:MaxRequestBodySize` | Maximum request size (5 MB by default) |
| `Cors:Origins` | Allowed origins of the Angular client (`http://localhost:4200` by default) |
| `ForwardedHeaders:KnownProxies`, `ForwardedHeaders:KnownNetworks` | Trusted reverse proxies for `X-Forwarded-For` and `X-Forwarded-Proto`. Without them the headers are ignored |
| `AllowedHosts` | Accepted `Host` values (set to the public host name in Docker) |
| `apiBaseUrl` (`public/config.json`) | Base URL of the API for the Angular client. Empty means same origin |

Authentication uses bearer tokens (no cookies). Behind a reverse proxy the per-IP rate limits need `ForwardedHeaders` to be set, otherwise all users share one limit.

## Deployment

The Angular client and the API run as two separate containers on an existing `docker-net` network, and the nginx already installed on the host publishes them (HTTPS with certbot). The images are built by the GitHub Actions workflow `.github/workflows/build-push.yml` and published on Docker Hub. The files are in `deploy/`:

| File | Role |
|---|---|
| `docker-compose.angular.yml` | `sagreeventi-web`: static client on `127.0.0.1:5417` (port to adjust) |
| `docker-compose.server.yml` | `sagreeventi-api`: no published port, reachable only inside `docker-net`, configured through `deploy/.env` (see `deploy/.env.example`) |
| `sites-available/myhost.mydomain.ext` | Host nginx virtual host, proxies to the Angular container |

Both compose files pull `${DOCKERHUB_USERNAME}/sagreeventi-api|web:latest` from Docker Hub (set `DOCKERHUB_USERNAME` in `deploy/.env`). The workflow needs the repository secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`; builds run without cache. On the server update with `docker compose -f <file> pull && docker compose -f <file> up -d`.

The nginx inside the Angular container (`src/SagreEventi.Web/nginx.conf`) serves the static files and forwards `/api/` to `http://sagreeventi-api:8080` through the Docker DNS, so the client and the API still share one origin and `apiBaseUrl` stays empty. Set `AllowedHosts` to the public host name and `ForwardedHeaders__KnownNetworks__0` to the subnet of `docker-net`. The step-by-step procedure is in [DEPLOY.md](DEPLOY.md).

> [!WARNING]
> The Docker files have been written but not yet tried on a real Docker host. For production use a managed or backed-up SQL Server and a secret store instead of `.env`.

## Resources

- [ASP.NET Core documentation](https://learn.microsoft.com/aspnet/core)
- [Entity Framework Core documentation](https://learn.microsoft.com/ef/core)
- [FusionCache](https://github.com/ZiggyCreatures/FusionCache)
- [Angular documentation](https://angular.dev)
- [PrimeNG](https://primeng.org)

## Contributing

Contributions are welcome. Report issues or open a pull request:

1. Fork the repository
2. Create a feature branch from `develop`
3. Make your changes
4. Open a pull request targeting `develop`

If you find the project helpful, a ⭐ on GitHub helps others discover it.

## License

Released under the MIT License. See [LICENSE](LICENSE) for details.

<!--
Topics: `angular`, `backend`, `csharp`, `docker`, `docker-compose`, `dotnet`, `frontend`, `fusion-cache`, `sql-server`
-->