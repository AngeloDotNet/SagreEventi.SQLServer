<div align="center">

# Sagre ed eventi enogastronomici <br />

**Un posto dove tenere traccia di sagre ed eventi enogastronomici, segnalati da chi ci va.**

[Panoramica](#panoramica) | [Funzionalità](#funzionalità) | [Documentazione](#documentazione) | [Per iniziare](#per-iniziare)

<img width="1000" height="420" alt="sagreeventi-devto-cover" src="https://github.com/user-attachments/assets/60d19983-03f0-4d17-ab83-32194877d1f6" /></div>

## Panoramica

SagreEventi (*sagre ed eventi enogastronomici*) è un'applicazione web per consultare, segnalare e gestire sagre ed eventi enogastronomici. Chiunque può segnalare un evento e vedere cosa c'è in programma, senza account. La modifica degli eventi esistenti è riservata agli utenti con ruolo `Admin` o `Editor`.

La soluzione ha un'API ASP.NET Core (solo API, nessuna interfaccia ospitata) e un client Angular + PrimeNG che la usa. Due container Docker (API e Angular) girano dietro il nginx dell'host. L'app **non** vende biglietti e non gestisce prenotazioni.

> [!NOTE]
> Angular è bloccato alla versione 21 di proposito: PrimeNG 21.1.x è l'ultima release di PrimeNG pubblicata con licenza MIT, mentre PrimeNG 22 introduce una chiave di licenza. Prima di aggiornare controlla le condizioni attuali di PrimeTek.

## Funzionalità

- **Consultare gli eventi:** una home con i prossimi eventi appesi a un festone, un catalogo con ricerca e un'agenda mese per mese.
- **Filtrare e ordinare:** per testo libero (senza distinzione di accenti), città e periodo (tutti, in corso, in arrivo: gli eventi terminati non compaiono), e per data, nome o città, in vista a griglia o a elenco.
- **Segnalare un evento:** un modulo validato con selettori di data e suggerimenti per le città. La segnalazione di un utente anonimo resta nascosta agli altri finché non è approvata; chi l'ha inviata la vede come *in attesa* sotto «Le mie» sul proprio dispositivo. Il modulo avverte che la segnalazione sarà visibile a tutti solo dopo la verifica degli amministratori.
- **Revisionare le segnalazioni:** `Admin` ed `Editor` approvano o rifiutano le segnalazioni in blocco su `/gestione/revisione` e possono ritirare un evento già approvato. Gli eventi segnalati da `Admin` o `Editor` sono pubblicati subito. «Gestione» è nel menu ⋮ della barra in alto, con il numero delle segnalazioni da moderare sul pulsante, e `Admin` ed `Editor` ricevono un riepilogo via email (vedi [Moderazione](docs/moderazione.md)).
- **Gestire gli utenti:** `Admin` crea, modifica (email, reset della password, ruoli) ed elimina gli utenti su `/gestione/utenti`. L'ultimo `Admin` non può essere rimosso.
- **Modificare gli eventi:** solo dopo l'accesso come `Admin` o `Editor`. Le modifiche anonime a eventi esistenti sono rifiutate dall'API (`403`).
- **Conclusione automatica:** il server conclude un evento quando la data di fine è passata. Un evento concluso non può più essere modificato da nessuno e l'API non ha la cancellazione.
- **Link nelle descrizioni:** gli indirizzi web scritti nella descrizione diventano link cliccabili (con il nome del sito) e il dettaglio ha un pulsante per aprire il programma.
- **Portarlo con sé:** aggiungi un evento al calendario (`.ics`), apri la città su una mappa, condividilo.
- **Funziona offline:** tutto ciò che vedi è salvato sul dispositivo e si sincronizza quando torna la connessione, quando riapri l'app e ogni 10 minuti se la pagina è aperta.
- **Installabile (PWA):** aggiungila alla schermata Home del telefono o installala sul desktop; l'app si apre anche senza rete e una nuova versione viene segnalata nella barra in alto.
- **Interfaccia accessibile:** interfaccia in italiano, tema chiaro e scuro, utilizzabile da tastiera e con screen reader, adattata fino al telefono.

## Documentazione

| Documento | Contenuto |
| --- | --- |
| [Architettura](docs/architettura.md) | Progetti della soluzione e motivazioni dello stack |
| [Moderazione](docs/moderazione.md) | Stati degli eventi e avviso via email ai moderatori |
| [Protezione anti-bot](docs/anti-bot.md) | Prova di lavoro sull'invio delle segnalazioni |
| [Sincronizzazione e PWA](docs/sincronizzazione-pwa.md) | Offline-first, installazione e aggiornamenti |
| [API](docs/api.md) | Endpoint e forma dell'evento |
| [Sviluppo](docs/sviluppo.md) | Build, test e migrazioni del database |
| [Configurazione](docs/configurazione.md) | Impostazioni e variabili d'ambiente |
| [Deployment](docs/deployment.md) | Immagini Docker, compose e nginx; procedura passo passo in [DEPLOY.md](DEPLOY.md) |

## Per iniziare

### Prerequisiti

- .NET 10 SDK (versione indicata in `global.json`)
- Un'istanza di SQL Server
- Node.js `^20.19`, `^22.12` o `^24` per il client Angular
- Docker con Compose v2, solo per il deploy (vedi [DEPLOY.md](DEPLOY.md))

### Configurare l'API

Clona il progetto:

```bash
git clone https://github.com/AngeloDotNet/SagreEventi.SQLServer.git
cd SagreEventi.SQLServer
```

Metti i segreti in `src/SagreEventi.Web.Server/appsettings.local.json`. È ignorato da git e caricato dopo `appsettings.json`:

```json
{
  "ConnectionStrings": { "Default": "Data Source=...;Initial Catalog=SagreEventi;User ID=...;Password=...;Encrypt=False" },
  "Identity": {
    "Admin": { "Email": "you@example.com", "Password": "a-strong-password" },
    "Editor": { "Email": "editor@example.com", "Password": "another-strong-password" }
  }
}
```

### Eseguire in locale

Avvia l'API:

```bash
cd src/SagreEventi.Web.Server
dotnet run
```

L'API ascolta su `https://localhost:5001` e `http://localhost:5000`. All'avvio applica le migrazioni EF Core (`Database:MigraAllAvvio`, solo SQL Server), crea i ruoli `Admin` ed `Editor` e gli utenti configurati in `Identity:Admin` e `Identity:Editor`. L'auto-registrazione pubblica è disattivata.

Avvia il client Angular in un secondo terminale:

```bash
cd src/SagreEventi.Web
npm install
npm start
```

`npm start` apre da solo il browser su `http://localhost:4200`. In sviluppo le richieste a `/api` sono inoltrate a `https://localhost:5001` (vedi `proxy.conf.json`).

> [!WARNING]
> I valori predefiniti di `appsettings.json` sono finti (`admin@sagreeventi.local`, `editor@sagreeventi.local`). Cambiali prima di qualsiasi deploy. Dopo l'aggiornamento di un database esistente ogni evento è `InAttesa`: accedi come `Admin` o `Editor`, apri `/gestione/revisione` e approva gli eventi esistenti (fino a 100 per volta).

## Risorse

- [Documentazione ASP.NET Core](https://learn.microsoft.com/aspnet/core)
- [Documentazione Entity Framework Core](https://learn.microsoft.com/ef/core)
- [FusionCache](https://github.com/ZiggyCreatures/FusionCache)
- [Documentazione Angular](https://angular.dev)
- [PrimeNG](https://primeng.org)

## Contribuire

I contributi sono benvenuti. Segnala un problema o apri una pull request:

1. Fai il fork del repository
2. Crea un branch di funzionalità a partire da `develop`
3. Applica le tue modifiche
4. Apri una pull request verso `develop`

Se il progetto ti è utile, una ⭐ su GitHub aiuta altri a scoprirlo.

## Licenza

Rilasciato con licenza MIT. Vedi [LICENSE](LICENSE) per i dettagli.
