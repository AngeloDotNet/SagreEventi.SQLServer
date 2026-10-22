# Food and wine festivals and events

[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
![.NET 10](https://img.shields.io/badge/.NET-10-512bd4?style=flat-square)
![Angular 21](https://img.shields.io/badge/Angular-21-dd0031?style=flat-square)
![PrimeNG 21](https://img.shields.io/badge/PrimeNG-21-6366f1?style=flat-square)

*Sagre ed eventi enogastronomici: a place to keep track of food and wine festivals reported by the people who go to them.*

> [!NOTE]
> The project has one ASP.NET Core API and two clients that talk to it: the original **Blazor WebAssembly** client and a new **Angular + PrimeNG** client. Both use the same public API and the same offline-first sync protocol, so you can run either one, or both against the same database.

Users report festivals and events (name, city, dates, description), browse what is on, and edit or close events they know about. There are no accounts and no authentication: the API is public by design. The app does **not** sell tickets, take bookings or moderate content.

## What you can do

- **Browse events:** a home page with the next events hanging from a festival bunting, a searchable catalog and a month-by-month agenda.
- **Filter and sort:** by free text (accent-insensitive), city and period (in progress, upcoming, finished), by date, name or city, in a grid or list view.
- **Report an event:** a validated form (same rules as the Blazor client) with date pickers and city suggestions.
- **Edit or close an event:** the API has no delete, so an event leaves the list when it is marked as concluded.
- **Take it with you:** add an event to your calendar (`.ics`), open its city on a map, share it.
- **Work offline:** everything you see is stored on the device and syncs when the connection is back.
- **Light and dark theme**, Italian UI, keyboard and screen-reader friendly, responsive down to a phone.

## 🛠️ Tech Stack

- **API:** ASP.NET Core (.NET 10), Entity Framework Core, SQL Server, FusionCache
- **Angular client:** Angular 21 (standalone components, signals, zoneless), PrimeNG 21 with a custom Aura preset, PrimeIcons
- **Blazor client:** Blazor WebAssembly (.NET 10), Blazored.LocalStorage, FluentValidation

**Why this stack:**

- **One contract, many clients:** the API is two endpoints, so a new client is a weekend of work.
- **Offline-first:** events live in `localStorage` and a small sync step reconciles them with SQL Server.
- **Few moving parts in the Angular client:** just Angular, PrimeNG (with its theme and icon packages) and RxJS. No state library and no CSS framework.
- **Runtime configuration:** the API address is read from `config.json`, so one build runs in every environment.

> [!IMPORTANT]
> **Why Angular 21 and not 22?** PrimeNG 21.1.x is the latest PrimeNG release published under the MIT license and it targets Angular 21. PrimeNG 22, which adds Angular 22 support, introduces a license key (with a free Community tier that requires registration). To stay fully free and officially compatible, the Angular client is pinned to Angular 21 and PrimeNG `^21.1.10`. Check PrimeTek's current terms before upgrading.

## Offline-first and sync

The Angular client keeps its own copy of the events and mirrors the protocol of the Blazor client:

1. **Push:** events created or edited on the device (marked as *pending*) are sent with `PUT /api/Eventi/UpdateEventi`.
2. **Pull:** changes made by others are fetched with `GET /api/Eventi/GetEventi?since=<cursor>`, where the cursor is the newest modification time the server has returned.
3. **Merge:** server data replaces local data unless the local copy is pending and newer. Concluded events are removed.

A sync runs at start-up, when the browser comes back online, and whenever you press the sync button in the top bar. The button shows how many changes are waiting.

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/Eventi/GetEventi?since={datetime}` | GET | Events modified after `since` |
| `/api/Eventi/UpdateEventi` | PUT | Inserts new events and updates the ones that are newer than the stored copy |

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
  "dataOraUltimaModifica": "2026-10-22T18:30:00.000Z"
}
```

## Quickstart (local)

**Prerequisites:** the .NET 10 SDK, a SQL Server instance, and Node.js `^20.19`, `^22.12` or `^24` for the Angular client.

### 1. API (and Blazor client)

Clone the project

```
git clone https://github.com/AngeloDotNet/SagreEventi.SQLServer.git
cd SagreEventi.SQLServer
```

Set the SQL Server connection string in `src/SagreEventi.Web.Server/appsettings.json` (`ConnectionStrings:Default`), then create the database from the included migration

```
dotnet ef database update --project src/SagreEventi.Web.Server
```

Start the server

```
cd src/SagreEventi.Web.Server
dotnet run
```

The API listens on `https://localhost:5001` and `http://localhost:5000`, Swagger is at `/swagger` in Development, and the Blazor client is served from the same address.

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

## Configuration

| Setting | Where | Description |
| --- | --- | --- |
| `ConnectionStrings:Default` | `src/SagreEventi.Web.Server/appsettings.json` | SQL Server connection string |
| `Kestrel:Limits:MaxRequestBodySize` | `src/SagreEventi.Web.Server/appsettings.json` | Maximum request size (5 MB by default) |
| `apiBaseUrl` | `src/SagreEventi.Web.Angular/public/config.json` | Base URL of the API, for example `https://api.example.com`. Empty means same origin |
| Dev proxy target | `src/SagreEventi.Web.Angular/proxy.conf.json` | Where `npm start` forwards `/api` |

> [!NOTE]
> The API allows any origin (CORS), so the Angular client can be hosted on a different domain from the API. If you host them separately, remember to enable HTTPS on both.

## Project structure

```
src/
├── SagreEventi.Shared/          Shared model (EventoModel)
├── SagreEventi.Web.Server/      ASP.NET Core API, EF Core, SQL Server
├── SagreEventi.Web.Client/      Blazor WebAssembly client
└── SagreEventi.Web.Angular/     Angular + PrimeNG client
    ├── public/                  config.json, manifest, favicon
    └── src/app/
        ├── core/                API client, offline store, utilities
        ├── features/            home, eventi (list, detail, form), agenda
        └── shared/              event card, bunting, sync status
```

## Project scope (v1)

**In scope**

- Public browsing and reporting of events, with no accounts
- Offline use and synchronisation with the server
- Two clients on one API

**Out of scope**

- Authentication, user profiles and moderation
- Ticketing, bookings and payments
- Deleting events (the API closes them instead)
- Images and maps inside the app

## What's next

- Installable offline app shell for the Angular client (service worker)
- Server-side search and pagination once the catalog grows
- Automated tests for the sync logic
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
