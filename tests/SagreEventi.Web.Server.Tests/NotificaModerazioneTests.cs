using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using SagreEventi.Shared.Models;
using SagreEventi.Web.Server.HostedServices;
using SagreEventi.Web.Server.Models.Entities;
using SagreEventi.Web.Server.Models.Identity;
using SagreEventi.Web.Server.Models.Services.Application;
using SagreEventi.Web.Server.Models.Services.Infrastructure;
using SagreEventi.Web.Server.Options;

namespace SagreEventi.Web.Server.Tests;

/// <summary>Moderation notice by e-mail: what is still to be notified (data service) and one cycle of the job, with a fake sender.</summary>
public class NotificaModerazioneTests : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private static readonly DateTime Vecchio = new(2020, 1, 1, 8, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Notificato = new(2026, 10, 31, 12, 0, 0, DateTimeKind.Utc);
    private const string EditorEmail = "editor@test.local";
    private const string BaseUrl = "https://sagre.test.example";

    private sealed class OrologioFisso(DateTime adesso) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => new(adesso, TimeSpan.Zero);
    }

    private readonly ApiFactory factory;
    private readonly FakeEmailSender mail;

    public NotificaModerazioneTests(ApiFactory factory)
    {
        this.factory = factory;
        mail = factory.Services.GetRequiredService<FakeEmailSender>();
    }

    /// <summary>The factory is shared by the tests of the class: every test starts with no events, no extra moderators and a clean sender.</summary>
    public async Task InitializeAsync()
    {
        mail.Azzera();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Eventi.RemoveRange(await db.Eventi.ToListAsync());
        await db.SaveChangesAsync();

        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        foreach (var utente in await userManager.Users.Where(u => u.Email != ApiFactory.AdminEmail).ToListAsync())
        {
            await userManager.DeleteAsync(utente);
        }
    }

    public Task DisposeAsync() => Task.CompletedTask;

    private async Task AggiungiAsync(string id, StatoModerazione stato = StatoModerazione.InAttesa, DateTime? notificataIl = null, string? nome = null)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Eventi.Add(new Evento
        {
            Id = id,
            NomeEvento = nome ?? "Sagra " + id,
            CittaEvento = "Verona",
            DataInizioEvento = DateTime.UtcNow.Date.AddDays(5),
            DataFineEvento = DateTime.UtcNow.Date.AddDays(7),
            DescrizioneEvento = "Descrizione " + id,
            DataOraUltimaModifica = Vecchio,
            Stato = stato,
            NotificataIl = notificataIl,
        });
        await db.SaveChangesAsync();
    }

    private async Task<Evento> LeggiAsync(string id)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.Eventi.AsNoTracking().SingleAsync(e => e.Id == id);
    }

    private async Task AggiungiModeratoreAsync(string email, string ruolo)
    {
        using var scope = factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var utente = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true };
        Assert.True((await userManager.CreateAsync(utente, "Passw0rd!Test")).Succeeded);
        Assert.True((await userManager.AddToRoleAsync(utente, ruolo)).Succeeded);
    }

    private ModerazioneHostedService CreaJob(DateTime? adesso = null)
        => new(
            factory.Services.GetRequiredService<IServiceScopeFactory>(),
            mail,
            factory.Services.GetRequiredService<IOptionsMonitor<ModerazioneOptions>>(),
            factory.Services.GetRequiredService<IOptionsMonitor<AppOptions>>(),
            new OrologioFisso(adesso ?? Notificato),
            NullLogger<ModerazioneHostedService>.Instance);

    private async Task<NotificaModerazione> LeggiNotificaAsync()
    {
        using var scope = factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<IEventiService>().GetNotificaModerazioneAsync(CancellationToken.None);
    }

    // ---- Data service

    [Fact]
    public async Task Notifica_CountsNewPendingReportsAndTheTotalOfThePendingOnes()
    {
        await AggiungiAsync("n-nuova-1");
        await AggiungiAsync("n-nuova-2");
        await AggiungiAsync("n-gia-notificata", notificataIl: Notificato);

        var notifica = await LeggiNotificaAsync();

        Assert.Equal(2, notifica.Nuove);
        Assert.Equal(["n-nuova-1", "n-nuova-2"], notifica.IdNuove.Order());
        Assert.Equal(3, notifica.TotaleInAttesa);
    }

    [Fact]
    public async Task Notifica_IgnoresApprovedAndRejectedReports()
    {
        await AggiungiAsync("n-approvata", StatoModerazione.Approvato);
        await AggiungiAsync("n-rifiutata", StatoModerazione.Rifiutato);
        await AggiungiAsync("n-attesa");

        var notifica = await LeggiNotificaAsync();

        Assert.Equal(["n-attesa"], notifica.IdNuove);
        Assert.Equal(1, notifica.TotaleInAttesa);
    }

    [Fact]
    public async Task Notifica_WithNothingPendingIsEmpty()
    {
        var notifica = await LeggiNotificaAsync();

        Assert.Equal(0, notifica.Nuove);
        Assert.Equal(0, notifica.TotaleInAttesa);
    }

    [Fact]
    public async Task SegnaNotificate_MarksOnlyThePendingOnesAndKeepsTheModificationDate()
    {
        await AggiungiAsync("s-attesa");
        await AggiungiAsync("s-approvata", StatoModerazione.Approvato);
        using var scope = factory.Services.CreateScope();
        var service = scope.ServiceProvider.GetRequiredService<IEventiService>();

        var segnate = await service.SegnaNotificateAsync(["s-attesa", "s-approvata", "s-inesistente"], Notificato, CancellationToken.None);

        Assert.Equal(1, segnate);
        var attesa = await LeggiAsync("s-attesa");
        Assert.Equal(Notificato, attesa.NotificataIl);
        Assert.Equal(Vecchio, attesa.DataOraUltimaModifica);
        Assert.Null((await LeggiAsync("s-approvata")).NotificataIl);
    }

    [Fact]
    public async Task SegnaNotificate_IsIdempotentAndKeepsTheFirstDate()
    {
        await AggiungiAsync("s-id");
        using var scope = factory.Services.CreateScope();
        var service = scope.ServiceProvider.GetRequiredService<IEventiService>();

        await service.SegnaNotificateAsync(["s-id"], Notificato, CancellationToken.None);
        var seconda = await service.SegnaNotificateAsync(["s-id"], Notificato.AddHours(5), CancellationToken.None);

        Assert.Equal(0, seconda);
        Assert.Equal(Notificato, (await LeggiAsync("s-id")).NotificataIl);
    }

    [Fact]
    public async Task SegnaNotificate_WithNoIdsDoesNothing()
    {
        using var scope = factory.Services.CreateScope();

        Assert.Equal(0, await scope.ServiceProvider.GetRequiredService<IEventiService>().SegnaNotificateAsync([], Notificato, CancellationToken.None));
    }

    // ---- Job

    [Fact]
    public async Task Job_WithNoReportsSendsNothing()
    {
        Assert.Equal(0, await CreaJob().EseguiCicloAsync(CancellationToken.None));
        Assert.Empty(mail.Inviati);
    }

    [Fact]
    public async Task Job_SendsOneMailPerModeratorWithTheNumbersAndTheReviewLink()
    {
        await AggiungiModeratoreAsync(EditorEmail, Ruoli.Editor);
        await AggiungiAsync("j-1");
        await AggiungiAsync("j-2");
        await AggiungiAsync("j-3", notificataIl: Notificato.AddDays(-1));

        var consegnate = await CreaJob().EseguiCicloAsync(CancellationToken.None);

        Assert.Equal(2, consegnate);
        Assert.Equal([ApiFactory.AdminEmail, EditorEmail], mail.Inviati.Select(m => m.To).Order(StringComparer.Ordinal));
        foreach (var messaggio in mail.Inviati)
        {
            Assert.Equal("Sagre & Eventi: 2 nuove segnalazioni da moderare", messaggio.Subject);
            Assert.Contains("Ci sono 2 nuove segnalazioni da moderare (3 in attesa in totale).", messaggio.Body);
            Assert.Contains(BaseUrl + "/gestione/revisione", messaggio.Body);
        }
    }

    [Fact]
    public async Task Job_MarksTheReportsAsNotifiedAndDoesNotSendThemAgain()
    {
        await AggiungiAsync("j-marca");

        await CreaJob().EseguiCicloAsync(CancellationToken.None);

        Assert.Equal(Notificato, (await LeggiAsync("j-marca")).NotificataIl);
        mail.Azzera();
        var secondo = await CreaJob().EseguiCicloAsync(CancellationToken.None);

        Assert.Equal(0, secondo);
        Assert.Empty(mail.Inviati);
    }

    [Fact]
    public async Task Job_ANewReportAfterTheFirstNoticeIsSentInTheNextOne()
    {
        await AggiungiAsync("j-prima");
        await CreaJob().EseguiCicloAsync(CancellationToken.None);
        await AggiungiAsync("j-dopo");

        await CreaJob().EseguiCicloAsync(CancellationToken.None);

        Assert.Equal(2, mail.Inviati.Count);
        Assert.Contains("1 nuova segnalazione da moderare (2 in attesa in totale)", mail.Inviati[1].Body);
        Assert.Equal("Sagre & Eventi: 1 nuova segnalazione da moderare", mail.Inviati[1].Subject);
    }

    [Fact]
    public async Task Job_NeverPutsTheTextOfTheReportsInTheMail()
    {
        const string ostile = "<script>alert(1)</script>\r\nBcc: attaccante@example.org";
        await AggiungiAsync("j-ostile", nome: ostile);

        await CreaJob().EseguiCicloAsync(CancellationToken.None);

        var messaggio = Assert.Single(mail.Inviati);
        Assert.DoesNotContain("script", messaggio.Subject + messaggio.Body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("attaccante", messaggio.Subject + messaggio.Body);
        Assert.DoesNotContain("Verona", messaggio.Body);
        Assert.DoesNotContain("Descrizione", messaggio.Body);
        Assert.DoesNotContain('\r', messaggio.Subject);
        Assert.DoesNotContain('\n', messaggio.Subject);
    }

    [Fact]
    public async Task Job_OneFailingRecipientDoesNotStopTheOthersAndTheReportsAreStillMarked()
    {
        await AggiungiModeratoreAsync(EditorEmail, Ruoli.Editor);
        await AggiungiAsync("j-parziale");
        mail.Falliscono.Add(ApiFactory.AdminEmail);

        var consegnate = await CreaJob().EseguiCicloAsync(CancellationToken.None);

        Assert.Equal(1, consegnate);
        Assert.Equal(EditorEmail, Assert.Single(mail.Inviati).To);
        Assert.NotNull((await LeggiAsync("j-parziale")).NotificataIl);
    }

    [Fact]
    public async Task Job_WhenEveryDeliveryFailsTheReportsStayNotNotifiedAndTheNextCycleRetries()
    {
        await AggiungiAsync("j-ritenta");
        mail.FallisceTutto = true;

        var primo = await CreaJob().EseguiCicloAsync(CancellationToken.None);

        Assert.Equal(0, primo);
        Assert.Empty(mail.Inviati);
        Assert.Null((await LeggiAsync("j-ritenta")).NotificataIl);

        mail.FallisceTutto = false;
        var secondo = await CreaJob().EseguiCicloAsync(CancellationToken.None);

        Assert.Equal(1, secondo);
        Assert.NotNull((await LeggiAsync("j-ritenta")).NotificataIl);
    }

    [Fact]
    public async Task Job_WithoutAnyModeratorAddressKeepsTheReportsForLater()
    {
        using (var scope = factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var admin = await userManager.FindByEmailAsync(ApiFactory.AdminEmail);
            Assert.NotNull(admin);
            // The e-mail is cleared in the database only for this test; the Identity validation is not involved
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Users.Where(u => u.Id == admin.Id).ExecuteUpdateAsync(s => s.SetProperty(u => u.Email, (string?)null));
        }

        try
        {
            await AggiungiAsync("j-senza");

            var consegnate = await CreaJob().EseguiCicloAsync(CancellationToken.None);

            Assert.Equal(0, consegnate);
            Assert.Null((await LeggiAsync("j-senza")).NotificataIl);
        }
        finally
        {
            using var scope = factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Users.Where(u => u.UserName == ApiFactory.AdminEmail).ExecuteUpdateAsync(s => s.SetProperty(u => u.Email, ApiFactory.AdminEmail));
        }
    }

    [Fact]
    public async Task Job_DoesNotMailUsersWhoAreNotModerators()
    {
        using (var scope = factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var semplice = new ApplicationUser { UserName = "semplice@test.local", Email = "semplice@test.local", EmailConfirmed = true };
            Assert.True((await userManager.CreateAsync(semplice, "Passw0rd!Test")).Succeeded);
        }

        await AggiungiAsync("j-ruoli");

        await CreaJob().EseguiCicloAsync(CancellationToken.None);

        Assert.DoesNotContain(mail.Inviati, m => m.To == "semplice@test.local");
        Assert.Equal(ApiFactory.AdminEmail, Assert.Single(mail.Inviati).To);
    }

    [Fact]
    public async Task Job_ACancelledCycleSendsNothingAndLeavesTheReportsToNotify()
    {
        await AggiungiAsync("j-annullato");
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        var consegnate = await CreaJob().EseguiCicloAsync(cts.Token);

        Assert.Equal(0, consegnate);
        Assert.Empty(mail.Inviati);
        Assert.Null((await LeggiAsync("j-annullato")).NotificataIl);
    }

    // ---- Message text

    [Theory]
    [InlineData(1, 1, "Sagre & Eventi: 1 nuova segnalazione da moderare", "C'è 1 nuova segnalazione da moderare (1 in attesa in totale).")]
    [InlineData(3, 12, "Sagre & Eventi: 3 nuove segnalazioni da moderare", "Ci sono 3 nuove segnalazioni da moderare (12 in attesa in totale).")]
    public void CostruisciMessaggio_UsesSingularAndPlural(int nuove, int totale, string oggettoAtteso, string fraseAttesa)
    {
        var (oggetto, corpo) = ModerazioneHostedService.CostruisciMessaggio(nuove, totale, BaseUrl);

        Assert.Equal(oggettoAtteso, oggetto);
        Assert.StartsWith(fraseAttesa, corpo);
    }

    [Theory]
    [InlineData("https://sagre.example.org", "https://sagre.example.org/gestione/revisione")]
    [InlineData("https://sagre.example.org/", "https://sagre.example.org/gestione/revisione")]
    [InlineData("https://sagre.example.org/app/", "https://sagre.example.org/app/gestione/revisione")]
    public void CostruisciMessaggio_BuildsTheLinkFromTheConfiguredAddressOnly(string baseUrl, string linkAtteso)
    {
        var (_, corpo) = ModerazioneHostedService.CostruisciMessaggio(1, 1, baseUrl);

        Assert.Contains(linkAtteso, corpo);
        Assert.DoesNotContain("//gestione", corpo.Replace("https://", string.Empty, StringComparison.Ordinal));
    }
}
