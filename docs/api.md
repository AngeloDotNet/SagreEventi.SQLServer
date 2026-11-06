# API

[← Torna al README](../README.md)

| Endpoint | Metodo | Scopo |
| --- | --- | --- |
| `/api/Eventi/GetEventi?since={datetime}` | GET | Eventi modificati dopo `since` |
| `/api/Eventi/UpdateEventi` | PUT | Inserisce nuovi eventi (anonimo, max 20 per richiesta, con limite di frequenza per IP). Aggiorna quelli esistenti solo con un token `Admin`/`Editor` |
| `/api/Eventi/GetChallenge` | GET | Challenge anti-bot firmata (anonimo, con limite di frequenza per IP, mai in cache) |
| `/api/Eventi/GetStati?ids=...` | GET | Stato degli eventi che hai segnalato (max 50 id). Un evento rifiutato risulta `InAttesa` |
| `/api/Eventi/Revisione/*` | GET, POST | Coda di revisione, approvazione, rifiuto ed eventi conclusi; solo `Admin`/`Editor` (`Conclusi` solo `Admin`) |
| `/api/admin/utenti`, `/api/admin/ruoli` | GET, POST, PUT, DELETE | Gestione utenti, solo `Admin` |
| `/api/auth/login`, `/api/auth/refresh`, `/api/auth/me` | POST, GET | Token bearer e di refresh, utente corrente. La registrazione è disattivata |

Il server imposta da solo `dataOraUltimaModifica` a ogni scrittura; il valore inviato dal client serve solo a decidere quale versione sia più recente. Il documento OpenAPI è su `/openapi/v1.json` in Development.

Un evento ha questa forma (JSON, camelCase):

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

`stato` è solo in uscita. I campi di testo hanno lunghezze massime (id 100, nome 200, città 100, descrizione 4000); valori più lunghi ricevono `400`.
