using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SagreEventi.Shared.Models;
using SagreEventi.Web.Server.Models.Entities;
using SagreEventi.Web.Server.Models.Services.Infrastructure;

namespace SagreEventi.Web.Server.Tests;

/// <summary>The <c>StatiModerazione</c> lookup table must mirror the <see cref="StatoModerazione"/> enum and be enforced as a foreign key.</summary>
public class StatiModerazioneTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory factory;

    public StatiModerazioneTests(ApiFactory factory)
    {
        this.factory = factory;
    }

    [Fact]
    public async Task LaTabellaDiLookupContieneTuttiIValoriDellEnumEsattamente()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var righe = await db.StatiModerazione.AsNoTracking().OrderBy(x => x.Id).ToListAsync();

        var attese = Enum.GetValues<StatoModerazione>().OrderBy(x => x).Select(x => (x, x.ToString())).ToList();
        Assert.Equal(attese, righe.Select(x => (x.Id, x.Nome)).ToList());
    }

    [Fact]
    public async Task UnEventoConStatoNonPresenteNellaTabellaVieneRifiutato()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Eventi.Add(NuovoEvento("stato-non-valido", (StatoModerazione)99));

        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }

    [Theory]
    [InlineData(StatoModerazione.InAttesa)]
    [InlineData(StatoModerazione.Approvato)]
    [InlineData(StatoModerazione.Rifiutato)]
    public async Task UnEventoConUnoStatoDellEnumVieneSalvato(StatoModerazione stato)
    {
        var id = "stato-valido-" + stato;
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Eventi.Add(NuovoEvento(id, stato));
        await db.SaveChangesAsync();

        var salvato = await db.Eventi.AsNoTracking().SingleAsync(x => x.Id == id);
        Assert.Equal(stato, salvato.Stato);
    }

    [Fact]
    public async Task UnoStatoUsatoDaUnEventoNonPuoEssereEliminatoDallaTabella()
    {
        using (var scopeScrittura = factory.Services.CreateScope())
        {
            var dbScrittura = scopeScrittura.ServiceProvider.GetRequiredService<AppDbContext>();
            dbScrittura.Eventi.Add(NuovoEvento("stato-in-uso", StatoModerazione.Rifiutato));
            await dbScrittura.SaveChangesAsync();
        }

        // A separate context, so that the change tracker does not know the event and the check is left to the database
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var riga = await db.StatiModerazione.SingleAsync(x => x.Id == StatoModerazione.Rifiutato);
        db.StatiModerazione.Remove(riga);

        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }

    private static Evento NuovoEvento(string id, StatoModerazione stato) => new()
    {
        Id = id,
        NomeEvento = "Sagra " + id,
        CittaEvento = "Verona",
        DataInizioEvento = new DateTime(2030, 1, 1, 8, 0, 0, DateTimeKind.Utc),
        DataFineEvento = new DateTime(2030, 1, 2, 8, 0, 0, DateTimeKind.Utc),
        DescrizioneEvento = "Descrizione",
        DataOraUltimaModifica = new DateTime(2030, 1, 1, 8, 0, 0, DateTimeKind.Utc),
        Stato = stato,
    };
}
