using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace SagreEventi.Web.Client.Components;

public partial class SyncEventi : ComponentBase
{
    [Parameter] public EventCallback ForceRefreshEventCallback { get; set; }
    [Parameter] public int CountEventi { get; set; }
    [Parameter] public int CountSync { get; set; }

    public bool OnLine { get; set; }
    public bool IsBusy { get; set; }

    protected override async Task OnInitializedAsync()
    {
        await base.OnInitializedAsync();
    }

    [JSInvokable("Connection.StatusChanged")]
    public void OnConnectionStatusChanged(bool isOnline)
    {
        if (OnLine != isOnline)
        {
            OnLine = isOnline;
            IsBusy = !isOnline;
        }

        StateHasChanged();
    }
    protected async override Task OnAfterRenderAsync(bool firstRender)
    {
        if (firstRender)
        {
            await JsRuntime.InvokeVoidAsync("Connection.Initialize", DotNetObjectReference.Create(this));
        }
    }

    public void Dispose() => JsRuntime.InvokeVoidAsync("Connection.Dispose");

    public async Task SynchronizeAsync()
    {
        IsBusy = true;

        await eventiLocalStorage.EseguiSyncWithDatabaseAsync();
        await ForceRefreshEventCallback.InvokeAsync();

        IsBusy = false;
    }
}