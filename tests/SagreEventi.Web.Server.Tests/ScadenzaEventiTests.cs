using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using SagreEventi.Shared.Models;
using SagreEventi.Web.Server.HostedServices;
using SagreEventi.Web.Server.Models.Entities;
using SagreEventi.Web.Server.Models.Services.Application;
using SagreEventi.Web.Server.Models.Services.Infrastructure;
using SagreEventi.Web.Server.Options;

namespace SagreEventi.Web.Server.Tests;

/// <summary>Scadenza automatica (step 7-ter): la conclusione degli eventi la decide solo il server.</summary>
public class ScadenzaEventiTests : IClassFixture<ApiFactory>
{
    private static readonly DateTime Vecchio = new(2020, 1, 1, 8, 0, 0, DateTimeKind.Utc);

    private readonly ApiFactory factory;

    public ScadenzaEventiTests(ApiFactory factory)
    {
        this.factory = factory;
    }

    private async Task AggiungiAsync(string id, DateTime fine, bool concluso = false, StatoModerazione stato = StatoModerazione.Approvato)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Eventi.Add(new Evento
        {
            Id = id,
            NomeEvento = "Sagra " + id,
            CittaEvento = "Verona",
            DataInizioEvento = fine.AddDays(-2),
            DataFineEvento = fine,
            DescrizioneEvento = "Descrizione",
            EventoConcluso = concluso,
            DataOraUltimaModifica = Vecchio,
            Stato = stato,
        });
        await db.SaveChangesAsync();
    }

    private async Task<Evento> LeggiAsync(string id)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.Eventi.FindAsync(id) ?? throw new InvalidOperationException($"Evento {id} non trovato");
    }

    private async Task<int> ConcludiAsync(DateTime adesso)
    {
        using var scope = factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<IEventiService>().ConcludiScadutiAsync(adesso, CancellationToken.None);
    }

    [Fact]
    public async Task ConcludiScaduti_ConcludeSoloGliEventiConDataDiFinePassataEAggiornaIlTimestamp()
    {
        var oggi = DateTime.UtcNow.Date;
        await AggiungiAsync("sc-passato", oggi.AddDays(-1));
        await AggiungiAsync("sc-oggi", oggi);
        await AggiungiAsync("sc-futuro", oggi.AddDays(10));
        var prima = DateTime.UtcNow.AddSeconds(-1);

        await ConcludiAsync(DateTime.UtcNow);

        var passato = await LeggiAsync("sc-passato");
        Assert.True(passato.EventoConcluso);
        Assert.True(passato.DataOraUltimaModifica > prima);
        // An event ending today is still in progress
        Assert.False((await LeggiAsync("sc-oggi")).EventoConcluso);
        var futuro = await LeggiAsync("sc-futuro");
        Assert.False(futuro.EventoConcluso);
        Assert.Equal(Vecchio, futuro.DataOraUltimaModifica);
    }

    [Fact]
    public async Task ConcludiScaduti_NonRielaboraGliEventiGiaConclusi()
    {
        await AggiungiAsync("sc-gia", DateTime.UtcNow.Date.AddDays(-5), concluso: true);

        await ConcludiAsync(DateTime.UtcNow);

        Assert.Equal(Vecchio, (await LeggiAsync("sc-gia")).DataOraUltimaModifica);
    }

    [Fact]
    public async Task ConcludiScaduti_RestituisceQuantiNeHaConclusi()
    {
        using var isolata = new ApiFactory();
        using (var scope = isolata.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            foreach (var (id, giorni, concluso) in new[] { ("a", -3, false), ("b", -1, false), ("c", 4, false), ("d", -9, true) })
            {
                var fine = DateTime.UtcNow.Date.AddDays(giorni);
                db.Eventi.Add(new Evento
                {
                    Id = id, NomeEvento = id, CittaEvento = "Verona", DataInizioEvento = fine, DataFineEvento = fine,
                    DescrizioneEvento = "d", EventoConcluso = concluso, DataOraUltimaModifica = Vecchio, Stato = StatoModerazione.Approvato,
                });
            }

            await db.SaveChangesAsync();
        }

        using var scope2 = isolata.Services.CreateScope();
        var servizio = scope2.ServiceProvider.GetRequiredService<IEventiService>();

        Assert.Equal(2, await servizio.ConcludiScadutiAsync(DateTime.UtcNow, CancellationToken.None));
        Assert.Equal(0, await servizio.ConcludiScadutiAsync(DateTime.UtcNow, CancellationToken.None));
    }

    [Fact]
    public async Task ConcludiScaduti_IClientRiceverannoLaConclusioneNelPullIncrementaleEInvalidaLaCache()
    {
        await AggiungiAsync("sc-pull", DateTime.UtcNow.Date.AddDays(-2));
        var client = factory.CreateClient();
        var url = $"/api/Eventi/GetEventi?since={Vecchio.AddDays(-1):yyyy-MM-ddTHH:mm:ss}";
        Assert.Contains((await client.GetFromJsonAsync<List<EventoModel>>(url))!, e => e.Id == "sc-pull" && !e.EventoConcluso); // fills the cache

        await ConcludiAsync(DateTime.UtcNow);

        var dopo = (await client.GetFromJsonAsync<List<EventoModel>>(url))!.Single(e => e.Id == "sc-pull");
        Assert.True(dopo.EventoConcluso);
    }

    [Fact]
    public async Task ConcludiScaduti_UnEventoInAttesaScadutoVieneConclusoMaNonDiventaPubblico()
    {
        await AggiungiAsync("sc-attesa", DateTime.UtcNow.Date.AddDays(-2), stato: StatoModerazione.InAttesa);

        await ConcludiAsync(DateTime.UtcNow);

        Assert.True((await LeggiAsync("sc-attesa")).EventoConcluso);
        var pubblici = await factory.CreateClient()
            .GetFromJsonAsync<List<EventoModel>>($"/api/Eventi/GetEventi?since={Vecchio.AddDays(-1):yyyy-MM-ddTHH:mm:ss}");
        Assert.DoesNotContain(pubblici!, e => e.Id == "sc-attesa");
    }

    // ---------- Background service ----------

    [Theory]
    [InlineData(0, 60)]
    [InlineData(-5, 60)]
    [InlineData(1, 1)]
    [InlineData(15, 15)]
    public void Opzioni_LIntervalloNonPositivoTornaAlDefault(double minuti, double atteso)
    {
        var opzioni = new ScadenzaEventiOptions { ScadenzaIntervalloMinuti = minuti };

        Assert.Equal(TimeSpan.FromMinutes(atteso), opzioni.Intervallo);
    }

    [Fact]
    public async Task Servizio_EseguiCicloConcludeGliScaduti()
    {
        await AggiungiAsync("sv-ciclo", DateTime.UtcNow.Date.AddDays(-3));
        var servizio = NuovoServizio(new MonitorOpzioni(new ScadenzaEventiOptions()));

        var conclusi = await servizio.EseguiCicloAsync(CancellationToken.None);

        Assert.True(conclusi >= 1);
        Assert.True((await LeggiAsync("sv-ciclo")).EventoConcluso);
    }

    [Fact]
    public async Task Servizio_ParteSubitoELIntervalloSiAggiornaACaldo()
    {
        await AggiungiAsync("sv-subito", DateTime.UtcNow.Date.AddDays(-3));
        var monitor = new MonitorOpzioni(new ScadenzaEventiOptions { ScadenzaIntervalloMinuti = 60 });
        var servizio = NuovoServizio(monitor);

        await servizio.StartAsync(CancellationToken.None);
        try
        {
            // First immediate cycle, without waiting for the interval
            await AttendiAsync(async () => (await LeggiAsync("sv-subito")).EventoConcluso);

            // New expired event: with the 60-minute interval it would not be picked up, unless the change applies at runtime
            await AggiungiAsync("sv-caldo", DateTime.UtcNow.Date.AddDays(-3));
            monitor.Imposta(new ScadenzaEventiOptions { ScadenzaIntervalloMinuti = 0.0005 }); // 30 ms
            await AttendiAsync(async () => (await LeggiAsync("sv-caldo")).EventoConcluso);
        }
        finally
        {
            await servizio.StopAsync(CancellationToken.None);
        }

        Assert.True(servizio.ExecuteTask!.IsCompleted);
    }

    private EventiHostedService NuovoServizio(IOptionsMonitor<ScadenzaEventiOptions> monitor) =>
        new(factory.Services.GetRequiredService<IServiceScopeFactory>(), monitor, NullLogger<EventiHostedService>.Instance);

    private static async Task AttendiAsync(Func<Task<bool>> condizione)
    {
        var limite = DateTime.UtcNow.AddSeconds(10);
        while (DateTime.UtcNow < limite)
        {
            if (await condizione())
            {
                return;
            }

            await Task.Delay(50);
        }

        Assert.Fail("Condizione non raggiunta entro 10 secondi");
    }

    private sealed class MonitorOpzioni(ScadenzaEventiOptions iniziale) : IOptionsMonitor<ScadenzaEventiOptions>
    {
        private readonly List<Action<ScadenzaEventiOptions, string?>> ascoltatori = [];

        public ScadenzaEventiOptions CurrentValue { get; private set; } = iniziale;

        public ScadenzaEventiOptions Get(string? name) => CurrentValue;

        public IDisposable? OnChange(Action<ScadenzaEventiOptions, string?> listener)
        {
            ascoltatori.Add(listener);
            return new Annulla(() => ascoltatori.Remove(listener));
        }

        public void Imposta(ScadenzaEventiOptions nuove)
        {
            CurrentValue = nuove;
            foreach (var a in ascoltatori.ToList())
            {
                a(nuove, null);
            }
        }

        private sealed class Annulla(Action azione) : IDisposable
        {
            public void Dispose() => azione();
        }
    }
}
