using Microsoft.AspNetCore.Components;
using SagreEventi.Shared.Models;

namespace SagreEventi.Web.Client.Pages;

public partial class Index : ComponentBase
{
    public List<EventoModel> ListaEventi { get; set; }
    public int EventiDaSincronizzare { get; set; }
    public bool RefreshApp { get; set; } = false;

    protected override async Task OnInitializedAsync()
    {
        await RefreshListaEventiAsync();
    }

    public async Task RefreshListaEventiAsync()
    {
        ListaEventi = await eventiLocalStorage.GetListaEventiAsync();
        EventiDaSincronizzare = await eventiLocalStorage.GetEventiDaSincronizzareAsync();

        StateHasChanged();
    }
}