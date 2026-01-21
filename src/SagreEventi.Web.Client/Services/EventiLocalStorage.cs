using System.Net.Http.Json;
using Blazored.LocalStorage;
using SagreEventi.Shared.Models;

namespace SagreEventi.Web.Client.Services;

public class EventiLocalStorage(HttpClient httpClient, ILocalStorageService localStorageService)
{
    private readonly HttpClient httpClient = httpClient;
    private readonly ILocalStorageService localStorageService = localStorageService;

    const string EventiLocalStore = "EventiLocalStore";
    const string PathApplicationAPI = "api/Eventi";

    /// <summary>
    /// Gets the stored <see cref="EventiStore"/> from browser local storage.
    /// </summary>
    /// <returns>
    /// The stored <see cref="EventiStore"/> if present; otherwise a new empty <see cref="EventiStore"/>.
    /// </returns>
    public async Task<EventiStore> GetEventiStoreAsync()
    {
        var eventoStore = await localStorageService.GetItemAsync<EventiStore>(EventiLocalStore);

        eventoStore ??= new EventiStore();

        return eventoStore;
    }

    /// <summary>
    /// Adds or updates an <see cref="EventoModel"/> in the local store and persists the store to browser local storage.
    /// </summary>
    /// <param name="eventoModel">
    /// The event to add or update. If <see cref="EventoModel.Id"/> is <see langword="null" /> or empty a new GUID is generated.
    /// </param>
    /// <returns>A <see cref="Task"/> that completes when the store has been persisted.</returns>
    /// <remarks>
    /// This method updates <see cref="EventoModel.DataOraUltimaModifica"/> to <see cref="DateTime.Now"/> before saving.
    /// If the event already exists it is replaced; otherwise it is appended to the list.
    /// </remarks>
    public async Task SalvaEventoAsync(EventoModel eventoModel)
    {
        var eventiStore = await GetEventiStoreAsync();

        eventoModel.DataOraUltimaModifica = DateTime.Now;

        if (string.IsNullOrEmpty(eventoModel.Id))
        {
            eventoModel.Id = Guid.NewGuid().ToString();
            eventiStore.ListaEventi.Add(eventoModel);
        }
        else
        {
            if (eventiStore.ListaEventi.Where(x => x.Id == eventoModel.Id).Any())
            {
                eventiStore.ListaEventi[eventiStore.ListaEventi.FindIndex(ind => ind.Id == eventoModel.Id)] = eventoModel;
            }
            else
            {
                eventiStore.ListaEventi.Add(eventoModel);
            }
        }

        await localStorageService.SetItemAsync(EventiLocalStore, eventiStore);
    }

    /// <summary>
    /// Synchronizes local events with the backend API.
    /// </summary>
    /// <returns>A <see cref="Task"/> that completes when synchronization is finished.</returns>
    /// <remarks>
    /// The method performs the following steps:
    /// 1. Pushes locally modified events (those with a modification date newer than the last server sync) to
    ///    <c>PUT api/Eventi/UpdateEventi</c>.
    /// 2. Removes locally concluded events after a successful push.
    /// 3. Pulls server-side changes since the last known server sync from
    ///    <c>GET api/Eventi/GetEventi?since=...</c> and merges them into the local store.
    /// 4. Updates the local store's last server sync timestamp to the maximum modification time returned by the server.
    /// </remarks>
    public async Task EseguiSyncWithDatabaseAsync()
    {
        var EventoStore = await GetEventiStoreAsync();
        var DataOraUltimoSyncServer = EventoStore.DataOraUltimoSyncServer;

        var ListaEventiDaSincronizzare = EventoStore.ListaEventi.Where(x => x.DataOraUltimaModifica > EventoStore.DataOraUltimoSyncServer);

        if (ListaEventiDaSincronizzare.Any())
        {
            (await httpClient.PutAsJsonAsync($"{PathApplicationAPI}/UpdateEventi", ListaEventiDaSincronizzare)).EnsureSuccessStatusCode();

            //Quelli conclusi non servono più quindi li cancello
            EventoStore.ListaEventi.RemoveAll(x => x.EventoConcluso);
        }

        var json = await httpClient.GetFromJsonAsync<List<EventoModel>>($"{PathApplicationAPI}/GetEventi?since={DataOraUltimoSyncServer:o}");

        foreach (var itemjson in json)
        {

            var itemlocale = EventoStore.ListaEventi.Where(x => x.Id == itemjson.Id).FirstOrDefault();

            if (itemlocale == null)
            {
                if (!itemjson.EventoConcluso)
                {
                    EventoStore.ListaEventi.Add(itemjson);
                }
            }
            else
            {
                if (itemjson.EventoConcluso)
                {
                    EventoStore.ListaEventi.Remove(itemlocale);
                }
                else
                {
                    EventoStore.ListaEventi[EventoStore.ListaEventi.FindIndex(ind => ind.Id == itemjson.Id)] = itemjson;
                }
            }
        }

        if (json.Count > 0)
        {
            EventoStore.DataOraUltimoSyncServer = json.Max(x => x.DataOraUltimaModifica);
        }

        await localStorageService.SetItemAsync(EventiLocalStore, EventoStore);
    }

    /// <summary>
    /// Returns a list of non-concluded events from the local store, sorted by name.
    /// </summary>
    /// <returns>
    /// A <see cref="Task{TResult}"/> that returns a <see cref="List{EventoModel}"/> containing events
    /// where <c>EventoConcluso</c> is <see langword="false" />, ordered by <c>NomeEvento</c>.
    /// </returns>
    public async Task<List<EventoModel>> GetListaEventiAsync()
    {
        var eventiStore = await GetEventiStoreAsync();

        return eventiStore.ListaEventi.Where(x => x.EventoConcluso == false).OrderBy(x => x.NomeEvento).ToList();
    }

    /// <summary>
    /// Returns the count of locally stored events that have been modified since the last server sync and need synchronization.
    /// </summary>
    /// <returns>A <see cref="Task{Int32}"/> representing the number of events pending sync.</returns>
    public async Task<int> GetEventiDaSincronizzareAsync()
    {
        var eventiStore = await GetEventiStoreAsync();

        return eventiStore.ListaEventi.Where(x => x.DataOraUltimaModifica > eventiStore.DataOraUltimoSyncServer).Count();
    }
}