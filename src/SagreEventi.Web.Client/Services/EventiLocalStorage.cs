using System.Net.Http.Json;
using Blazored.LocalStorage;
using SagreEventi.Shared.Models;

namespace SagreEventi.Web.Client.Services;

public class EventiLocalStorage(HttpClient httpClient, ILocalStorageService localStorageService)
{
    private readonly HttpClient httpClient = httpClient;
    private readonly ILocalStorageService localStorageService = localStorageService;

    const string eventiLocalStore = "EventiLocalStore";
    const string pathApplicationAPI = "api/Eventi";

    /// <summary>
    /// Gets a list of locally saved events
    /// </summary>
    /// <returns></returns>
    public async Task<EventiStore> GetEventiStoreAsync()
    {
        var eventoStore = await localStorageService.GetItemAsync<EventiStore>(eventiLocalStore);

        eventoStore ??= new EventiStore();

        return eventoStore;
    }

    /// <summary>
    /// Save the new event
    /// </summary>
    /// <param name="eventoModel"></param>
    /// <returns></returns>
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

        await localStorageService.SetItemAsync(eventiLocalStore, eventiStore);
    }

    /// <summary>
    /// Performs event synchronization between frontend and backend
    /// </summary>
    /// <returns></returns>
    public async Task EseguiSyncWithDatabaseAsync()
    {
        var EventoStore = await GetEventiStoreAsync();
        var DataOraUltimoSyncServer = EventoStore.DataOraUltimoSyncServer;

        var ListaEventiDaSincronizzare = EventoStore.ListaEventi.Where(x => x.DataOraUltimaModifica > EventoStore.DataOraUltimoSyncServer);

        if (ListaEventiDaSincronizzare.Any())
        {
            (await httpClient.PutAsJsonAsync($"{pathApplicationAPI}/UpdateEventi", ListaEventiDaSincronizzare)).EnsureSuccessStatusCode();

            //Quelli conclusi non servono più quindi li cancello
            EventoStore.ListaEventi.RemoveAll(x => x.EventoConcluso);
        }

        var json = await httpClient.GetFromJsonAsync<List<EventoModel>>($"{pathApplicationAPI}/GetEventi?since={DataOraUltimoSyncServer:o}");

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

        await localStorageService.SetItemAsync(eventiLocalStore, EventoStore);
    }

    /// <summary>
    /// Gets a list of events
    /// </summary>
    /// <returns></returns>
    public async Task<List<EventoModel>> GetListaEventiAsync()
    {
        var eventiStore = await GetEventiStoreAsync();

        return eventiStore.ListaEventi.Where(x => x.EventoConcluso == false).OrderBy(x => x.NomeEvento).ToList();
    }

    /// <summary>
    /// Gets a list of locally saved events to synchronize
    /// </summary>
    /// <returns></returns>
    public async Task<int> GetEventiDaSincronizzareAsync()
    {
        var eventiStore = await GetEventiStoreAsync();

        return eventiStore.ListaEventi.Where(x => x.DataOraUltimaModifica > eventiStore.DataOraUltimoSyncServer).Count();
    }
}