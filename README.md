# Food and wine festivals and events

[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
![.NET 10](https://img.shields.io/badge/.NET-10-512bd4?style=flat-square)
![Angular 21](https://img.shields.io/badge/Angular-21-dd0031?style=flat-square)
![PrimeNG 21](https://img.shields.io/badge/PrimeNG-21-6366f1?style=flat-square)

*Sagre ed eventi enogastronomici: a place to keep track of food and wine festivals reported by the people who go to them.*

> [!NOTE]
> The project has one ASP.NET Core API (API only, no hosted UI) and an **Angular + PrimeNG** client that talks to it. The original Blazor WebAssembly client has been removed. A `docker-compose.yml` runs the whole stack behind a dedicated nginx (see [Docker](#docker)).

Anyone can report festivals and events (name, city, dates, description) and browse what is on, without an account. Editing existing events is reserved to users with the `Admin` or `Editor` role, who sign in with email and password (ASP.NET Core Identity, bearer tokens). Public self-registration is disabled: users are created by the seed at start-up. The app does **not** sell tickets or take bookings.

## What you can do

- **Browse events:** a home page with the next events hanging from a festival bunting, a searchable catalog and a month-by-month agenda.
- **Filter and sort:** by free text (accent-insensitive), city and period (in progress, upcoming, finished), by date, name or city, in a grid or list view.
- **Report an event:** a validated form with date pickers and city suggestions. A report from an anonymous user stays hidden from everyone else until it is approved; the reporter sees it as *pending* (or *rejected*, with the reason) under «Le mie» on their own device.
- **Manage users:** `Admin` opens `/gestione/utenti` to create, edit (email, password reset, roles) and delete users. The roles are fixed (`Admin`, `Editor`); an admin cannot delete themselves or drop their own `Admin` role, and the last `Admin` cannot be removed.
- **Review reports:** `Admin` and `Editor` open `/gestione/revisione` to approve or reject reports in bulk, and to withdraw an event that was already approved. Only `Admin` also gets a read-only «Conclusi» tab with the expired and withdrawn events. Events reported by `Admin`/`Editor` are published straight away.
- **Edit an event:** after signing in as `Admin` or `Editor`. Anonymous edits of existing events are rejected by the API (`403`). The API has no delete and users cannot conclude events: the server concludes an event automatically once its end date has passed (`Eventi:ScadenzaIntervalloMinuti`), and a concluded event can no longer be edited by anyone.
- **Take it with you:** add an event to your calendar (`.ics`), open its city on a map, share it.
- **Work offline:** everything you see is stored on the device and syncs when the connection is back.
- **Light and dark theme**, Italian UI, keyboard and screen-reader friendly, responsive down to a phone.

## 🛠️ Tech Stack

- **API:** ASP.NET Core (.NET 10) Minimal API, Entity Framework Core, SQL Server, ASP.NET Core Identity (roles), rate limiting, native OpenAPI, FusionCache
- **Angular client:** Angular 21 (standalone components, signals, zoneless), PrimeNG 21 with a custom Aura preset, PrimeIcons

**Why this stack:**

- **One contract, many clients:** the API is a handful of endpoints, so a new client is a weekend of work.
- **Offline-first:** events live in `localStorage` and a small sync step reconciles them with SQL Server.
- **Few moving parts in the Angular client:** just Angular, PrimeNG (with its theme and icon packages) and RxJS. No state library and no CSS framework.
- **Runtime configuration:** the API address is read from `config.json`, so one build runs in every environment.

> [!IMPORTANT]
> **Why Angular 21 and not 22?** PrimeNG 21.1.x is the latest PrimeNG release published under the MIT license and it targets Angular 21. PrimeNG 22, which adds Angular 22 support, introduces a license key (with a free Community tier that requires registration). To stay fully free and officially compatible, the Angular client is pinned to Angular 21 and PrimeNG `^21.1.10`. Check PrimeTek's current terms before upgrading.

## Moderation

States: `InAttesa` (default for anonymous reports), `Approvato`, `Rifiutato`. Only approved events are returned by `GetEventi`; the client and the server never trust a state sent by a client. Rejected events are kept with an optional note (history only, visible to `Admin`/`Editor`): whoever reported the event is told nothing about a rejection, it still shows as pending. Withdrawing an approved event turns it into a rejected, concluded one, which clients use to delete their local copy at the next sync.

After upgrading an existing database every event is `InAttesa`: sign in as `Admin`/`Editor`, open `/gestione/revisione` and approve the existing events (select all, up to 100 per round).

## Offline-first and sync

The Angular client keeps its own copy of the events and syncs with the API using this protocol:

1. **Push:** events created or edited on the device (marked as *pending*) are sent with `PUT /api/Eventi/UpdateEventi`.
2. **Pull:** changes made by others are fetched with `GET /api/Eventi/GetEventi?since=<cursor>`, where the cursor is the newest modification time the server has returned.
3. **Merge:** server data replaces local data unless the local copy is pending and newer. Concluded events are removed.

A sync runs at start-up, when the browser comes back online, and whenever you press the sync button in the top bar. The button shows how many changes are waiting.

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/Eventi/GetEventi?since={datetime}` | GET | Events modified after `since` |
| `/api/Eventi/UpdateEventi` | PUT | Inserts new events (anonymous). Updates the existing ones that are newer than the stored copy, only with an `Admin`/`Editor` token: for everyone else a change to an existing event gets `403` (new events in the same request are still inserted; re-sending an identical copy stays `200`). Max 20 events per request, rate limited per IP |
| `/api/Eventi/GetStati?ids=...` | GET | State (`InAttesa`/`Approvato`; a rejected event is reported as `InAttesa`, never with its note) of the events you reported. Anonymous, max 50 ids, rate limited per IP |
| `/api/Eventi/Revisione/DaRivedere?stato=InAttesa|Rifiutato` | GET | Reports to review (`Admin`/`Editor` only) |
| `/api/Eventi/Revisione/Approva`, `/Rifiuta` | POST | Approve or reject up to 100 events (`Rifiuta` takes an optional note; rejecting an approved event withdraws it) |
| `/api/Eventi/Revisione/Conclusi` | GET | Concluded (expired or withdrawn) events in any state, read-only history with the rejection note; `Admin` only, latest 200 |
| `/api/admin/utenti` (GET, POST), `/api/admin/utenti/{id}` (PUT, DELETE), `/api/admin/ruoli` (GET) | - | User management, `Admin` only (`401` anonymous, `403` otherwise). `PUT` replaces the user's roles; an empty password leaves it unchanged |
| `/api/auth/login`, `/api/auth/refresh` | POST | Bearer token and refresh token (rate limited per IP). Registration is disabled |
| `/api/auth/me` | GET | Signed-in user with the roles read from the database |
| `/healthz` | GET | Liveness probe used by Docker (anonymous, no details); not routed by the nginx proxy |

The server sets `dataOraUltimaModifica` itself on every write: the value sent by the client is only used to decide which version is newer. The OpenAPI document is at `/openapi/v1.json` in Development.

An event looks like this (JSON, camelCase):

```
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

`stato` is output only: the server ignores it on input. Text fields have maximum lengths (id 100, name 200, city 100, description 4000) and longer values get `400`.

## Quickstart (local)

**Prerequisites:** the .NET 10 SDK, a SQL Server instance, and Node.js `^20.19`, `^22.12` or `^24` for the Angular client.

### 1. API

Clone the project

```
git clone https://github.com/AngeloDotNet/SagreEventi.SQLServer.git
cd SagreEventi.SQLServer
```

Put your secrets in `src/SagreEventi.Web.Server/appsettings.local.json` (git-ignored, loaded after `appsettings.json`), for example the SQL Server connection string and the first users

```
{
  "ConnectionStrings": { "Default": "Data Source=...;Initial Catalog=SagreEventi;User ID=...;Password=...;Encrypt=False" },
  "Identity": {
    "Admin": { "Email": "you@example.com", "Password": "a-strong-password" },
    "Editor": { "Email": "editor@example.com", "Password": "another-strong-password" }
  }
}
```

Start the server

```
cd src/SagreEventi.Web.Server
dotnet run
```

On start-up the API applies the EF Core migrations (`Database:MigraAllAvvio`, SQL Server only), creates the `Admin` and `Editor` roles and the users configured in `Identity:Admin` / `Identity:Editor`. The defaults in `appsettings.json` are **fake** (`admin@sagreeventi.local`, `editor@sagreeventi.local`): change them before any deploy, and consider turning `MigraAllAvvio` off in production and running `dotnet ef database update --project src/SagreEventi.Web.Server` explicitly.

The API listens on `https://localhost:5001` and `http://localhost:5000`; the OpenAPI document is at `/openapi/v1.json` in Development. The API serves no web pages: open the Angular client.

### 2. Angular client

```
cd src/SagreEventi.Web.Angular
npm install
npm start
```

Open `http://localhost:4200`. In development, requests to `/api` are proxied to `https://localhost:5001` (see `proxy.conf.json`), so there is nothing else to configure.

Production build

```
npm run build
```

The static site is created in `dist/sagre-eventi-web/browser`. Serve it with any static host that falls back to `index.html` for unknown paths, and point it at the API by editing `config.json` next to `index.html`.

### 3. Tests

```
dotnet test
```

The API has integration tests (xUnit, in-memory SQLite) that cover events, moderation, users, login, rate limits, forwarded headers, CORS and malicious input. Check the NuGet packages for known vulnerabilities with `dotnet list package --vulnerable --include-transitive`.

## Docker

`docker-compose.yml` in the root starts four containers on a private network:

| Service | Image | Role |
| --- | --- | --- |
| `sqlserver` | `mssql/server:2022-latest` | Database, data in the `sqldata` volume |
| `api` | `src/SagreEventi.Web.Server/Dockerfile` | The API on port 8080 (internal only), non-root user, health check on `/healthz` |
| `web` | `src/SagreEventi.Web.Angular/Dockerfile` | The built Angular client served by an unprivileged nginx, SPA fallback |
| `proxy` | `deploy/nginx/Dockerfile` | A dedicated nginx: the **only** public entry point (ports 80/443). Terminates HTTPS, serves `/` from `web` and forwards `/api/` to `api` |

The client and the API share one origin, so production needs no CORS and `config.json` keeps `apiBaseUrl` empty.

```
copy .env.example .env      # then fill it in (use cp on Linux/macOS)
```

Create the certificate in `deploy/certs/` (`fullchain.pem` and `privkey.pem`). For a trial, a self-signed one:

```
openssl req -x509 -nodes -newkey rsa:2048 -days 365 -keyout deploy/certs/privkey.pem -out deploy/certs/fullchain.pem -subj "/CN=localhost"
```

Build and start

```
docker compose up --build
```

Then open `https://localhost` (or your `SERVER_NAME`). Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`. The migrations run at start-up and the `Admin` user is created.

| Variable in `.env` | Description |
| --- | --- |
| `SERVER_NAME` | Host name served by nginx; it is also the only `Host` the API accepts (`AllowedHosts`) |
| `SQL_SA_PASSWORD` | Password of the `sa` user of the SQL Server container |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | First `Admin` user |
| `EDITOR_EMAIL`, `EDITOR_PASSWORD` | Optional `Editor` user |
| `HTTP_PORT`, `HTTPS_PORT` | Published ports (80 and 443 by default) |

`.env` and `deploy/certs/` are git-ignored: never commit them. The API trusts `X-Forwarded-For` and `X-Forwarded-Proto` only from the Docker network (`ForwardedHeaders__KnownNetworks__0`), and nginx overwrites `X-Forwarded-For` with the real client address, so the per-IP rate limits cannot be dodged. nginx also rejects bodies over 5 MB (`413`), redirects HTTP to HTTPS and sends HSTS.

> [!WARNING]
> The Docker files have been written but **not yet tried** on a real Docker host. The checks to run by hand are in [TEST-MANUALI.md](TEST-MANUALI.md). The compose file is meant for trial and small deployments: for production use real certificates, a managed or backed-up SQL Server and a secret store instead of `.env`.

## Configuration

| Setting | Where | Description |
| --- | --- | --- |
| `ConnectionStrings:Default` | `src/SagreEventi.Web.Server/appsettings.json` | SQL Server connection string |
| `Kestrel:Limits:MaxRequestBodySize` | `src/SagreEventi.Web.Server/appsettings.json` | Maximum request size (5 MB by default) |
| `Identity:Admin`, `Identity:Editor` | `appsettings.local.json` or environment variables | Email and password of the users created at start-up |
| `Identity:RegistrazionePubblica` | `src/SagreEventi.Web.Server/appsettings.json` | `true` re-enables public registration (off by default) |
| `Database:MigraAllAvvio` | `src/SagreEventi.Web.Server/appsettings.json` | Apply migrations at start-up (SQL Server only) |
| `Eventi:MaxPerRichiesta`, `Eventi:RichiestePutAlMinuto` | `src/SagreEventi.Web.Server/appsettings.json` | Anonymous write limits: events per `PUT` (20) and `PUT` requests per minute per IP (10) |
| `Eventi:ScadenzaIntervalloMinuti` | `src/SagreEventi.Web.Server/appsettings.json` (optional) | Minutes between two runs of the automatic expiry of events (60 by default, fractions allowed); changes apply without a restart |
| `Cors:Origins` | `src/SagreEventi.Web.Server/appsettings.json` | Allowed origins of the Angular client (`http://localhost:4200` by default); blank entries are ignored, and behind the same-origin proxy none is needed |
| `ForwardedHeaders:KnownProxies`, `ForwardedHeaders:KnownNetworks` | environment variables or `appsettings.local.json` | IPs or CIDR networks of the reverse proxies trusted for `X-Forwarded-For` / `X-Forwarded-Proto`. Without them the headers are ignored |
| `AllowedHosts` | `src/SagreEventi.Web.Server/appsettings.json` | Accepted `Host` values (set to `SERVER_NAME` in Docker) |
| `apiBaseUrl` | `src/SagreEventi.Web.Angular/public/config.json` | Base URL of the API, for example `https://api.example.com`. Empty means same origin |
| Dev proxy target | `src/SagreEventi.Web.Angular/proxy.conf.json` | Where `npm start` forwards `/api` |

> [!NOTE]
> CORS only allows the origins listed in `Cors:Origins`, so the Angular client can be hosted on a different domain from the API as long as its origin is listed. Authentication uses bearer tokens (no cookies). Host both over HTTPS. Behind a reverse proxy the per-IP rate limits need `ForwardedHeaders:KnownProxies` or `KnownNetworks` to be set (the Docker compose does it), otherwise all users share one limit. Settings can also be given as environment variables, with `__` as the separator (`Identity__Admin__Email`).

## Project structure

```
docker-compose.yml               SQL Server + API + web + nginx proxy
.env.example                     Variables of the compose file (copy to .env)
deploy/nginx/                    Dedicated nginx reverse proxy (Dockerfile, template)
tests/                           API integration tests (xUnit, in-memory SQLite)
PLAN-*.md                        Plans of the backend migration and of the moderation
TEST-MANUALI.md                  Manual checks still to do (Docker, HTTPS, proxy limits)
CHANGES.md                       Log of the changes, newest first
src/
├── SagreEventi.Shared/          Shared models (EventoModel, moderation DTOs)
├── SagreEventi.Web.Server/      ASP.NET Core API (Dockerfile)
│   ├── Endpoints/               Eventi, Revisione, admin users (Minimal API)
│   ├── Extensions/              Services, Identity, seed, OpenAPI
│   ├── HostedServices/          Automatic expiry of events
│   ├── Models/ Validation/      Entities, mappings, Identity, validators
│   └── Migrations/              EF Core migrations
└── SagreEventi.Web.Angular/     Angular + PrimeNG client (Dockerfile, nginx.conf)
    ├── public/                  config.json, manifest, favicon
    └── src/app/
        ├── core/                API client, auth, offline store, utilities
        ├── features/            home, eventi (list, detail, form), agenda, login,
        │                        segnalazioni, gestione (revisione, amministrazione)
        └── shared/              event card, bunting, sync status
```

## Project scope (v1)

**In scope**

- Public browsing and reporting of events, with no account needed
- Sign-in with roles (`Admin`, `Editor`) to edit existing events
- Offline use and synchronisation with the server

**Out of scope**

- Public registration and user profiles (the `Admin` manages users)
- Ticketing, bookings and payments
- Deleting events (the API closes them instead)
- Images and maps inside the app

## What's next

- Try the Docker stack on a real host and tick off [TEST-MANUALI.md](TEST-MANUALI.md)
- Installable offline app shell for the Angular client (service worker)
- Server-side search and pagination once the catalog grows
- Automated tests for the Angular sync logic (the API already has tests)
- Geolocation: events near you

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⭐ Give a Star

Don't forget that if you find this project helpful, please give it a ⭐ on GitHub to show your support and help others discover it.

## 🤝 Contributing

Contributions are always welcome. Feel free to report issues and submit pull requests to the repository, following the steps below:

1. Fork the repository
2. Create a feature branch (starting from the develop branch)
3. Make your changes
4. Submit a pull requests (targeting develop)

<!--
## 💡 Inspired by

https://bit.ly/3bVT5q4

The structure of this README is inspired by [MoneyBrain](https://github.com/kasuken/MoneyBrain).
-->
