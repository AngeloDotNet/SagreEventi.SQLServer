using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SagreEventi.Shared.Models;
using SagreEventi.Web.Server.Models.Entities;
using SagreEventi.Web.Server.Models.Identity;
using SagreEventi.Web.Server.Models.Services.Infrastructure;

namespace SagreEventi.Web.Server.Tests;

/// <summary>
/// Fotografa il comportamento attuale di GET api/Eventi/GetEventi e PUT api/Eventi/UpdateEventi,
/// che deve restare invariato durante la migrazione a Minimal API.
/// </summary>
public class EventiApiTests : IClassFixture<ApiFactory>
{
    private static readonly DateTime Base = new(2026, 6, 1, 10, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Passato = new(2000, 1, 1);

    private readonly ApiFactory factory;

    public EventiApiTests(ApiFactory factory)
    {
        this.factory = factory;
    }

    private static EventoModel NuovoEvento(string id, DateTime ultimaModifica, bool concluso = false) => new()
    {
        Id = id,
        NomeEvento = "Sagra " + id,
        CittaEvento = "Verona",
        DataInizioEvento = new DateTime(2026, 7, 1),
        DataFineEvento = new DateTime(2026, 7, 3),
        DescrizioneEvento = "Descrizione",
        EventoConcluso = concluso,
        DataOraUltimaModifica = ultimaModifica,
    };

    // The server sets the timestamp with UtcNow: "more recent" comparisons are made against the current time
    private static DateTime Dopo() => DateTime.UtcNow.AddMinutes(5);
    private static DateTime Prima() => DateTime.UtcNow.AddMinutes(-5);

    private static string Url(DateTime since) => $"/api/Eventi/GetEventi?since={since:yyyy-MM-ddTHH:mm:ss}";

    private async Task<Evento?> LeggiDalDb(string id)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.Eventi.FindAsync(id);
    }

    // Login is limited to 10 requests per minute per IP: each role's token is obtained only once per factory
    private static readonly Dictionary<(ApiFactory, string), string> Token = [];
    private static readonly SemaphoreSlim LoginLock = new(1, 1);

    private async Task<HttpClient> ClientConRuoloAsync(string? ruolo)
    {
        var client = factory.CreateClient();
        var email = $"{ruolo ?? "nessuno"}@test.local".ToLowerInvariant();
        const string password = "Passw0rd!Test";

        await LoginLock.WaitAsync();
        try
        {
            if (!Token.TryGetValue((factory, email), out var token))
            {
                using (var scope = factory.Services.CreateScope())
                {
                    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
                    if (await userManager.FindByEmailAsync(email) is null)
                    {
                        var utente = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true };
                        Assert.True((await userManager.CreateAsync(utente, password)).Succeeded);
                        if (ruolo is not null)
                        {
                            Assert.True((await userManager.AddToRoleAsync(utente, ruolo)).Succeeded);
                        }
                    }
                }

                var login = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
                login.EnsureSuccessStatusCode();
                using var doc = JsonDocument.Parse(await login.Content.ReadAsStringAsync());
                token = doc.RootElement.GetProperty("accessToken").GetString()!;
                Token[(factory, email)] = token;
            }

            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }
        finally
        {
            LoginLock.Release();
        }

        return client;
    }

    [Fact]
    public async Task Put_InserisceEventoNuovo()
    {
        var client = factory.CreateClient();

        var response = await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("insert-1", Base) });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(string.Empty, await response.Content.ReadAsStringAsync());
        var salvato = await LeggiDalDb("insert-1");
        Assert.NotNull(salvato);
        Assert.Equal("Sagra insert-1", salvato.NomeEvento);
    }

    [Fact]
    public async Task Put_IgnoraEventoNuovoGiaConcluso()
    {
        var client = factory.CreateClient();

        var response = await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("concluso-1", Base, concluso: true) });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Null(await LeggiDalDb("concluso-1"));
    }

    [Fact]
    public async Task Put_AggiornaSeLaModificaEPiuRecente()
    {
        var client = await ClientConRuoloAsync(Ruoli.Editor);
        await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("upd-1", Base) });

        var modificato = NuovoEvento("upd-1", Dopo());
        modificato.NomeEvento = "Nome nuovo";
        var response = await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { modificato });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var salvato = await LeggiDalDb("upd-1");
        Assert.Equal("Nome nuovo", salvato!.NomeEvento);
    }

    [Fact]
    public async Task Put_IgnoraSeLaModificaEMenoRecente()
    {
        var client = await ClientConRuoloAsync(Ruoli.Editor);
        await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("old-1", Base) });

        var vecchio = NuovoEvento("old-1", Prima());
        vecchio.NomeEvento = "Da ignorare";
        await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { vecchio });

        var salvato = await LeggiDalDb("old-1");
        Assert.Equal("Sagra old-1", salvato!.NomeEvento);
    }

    [Fact]
    public async Task Put_AnonimoNonModificaEventiEsistenti()
    {
        var client = factory.CreateClient();
        await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("anon-1", Base) });

        var modificato = NuovoEvento("anon-1", Dopo());
        modificato.NomeEvento = "Modifica anonima";
        var response = await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { modificato });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("Sagra anon-1", (await LeggiDalDb("anon-1"))!.NomeEvento);
    }

    [Fact]
    public async Task Put_UtenteSenzaRuoloNonModificaEventiEsistenti()
    {
        var anonimo = factory.CreateClient();
        await anonimo.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("norole-1", Base) });
        var client = await ClientConRuoloAsync(null);

        var modificato = NuovoEvento("norole-1", Dopo());
        modificato.NomeEvento = "Senza ruolo";
        var risposta = await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { modificato });

        Assert.Equal(HttpStatusCode.Forbidden, risposta.StatusCode);
        Assert.Equal("Sagra norole-1", (await LeggiDalDb("norole-1"))!.NomeEvento);
    }

    [Fact]
    public async Task Put_ReinvioIdenticoDiUnEventoEsistenteDaAnonimoRestaOk()
    {
        var client = factory.CreateClient();
        var evento = NuovoEvento("retry-1", Base);
        (await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { evento })).EnsureSuccessStatusCode();

        var risposta = await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { evento });

        Assert.Equal(HttpStatusCode.OK, risposta.StatusCode);
    }

    [Fact]
    public async Task Put_AnonimoPuoInserireEventiNuoviAncheInUnaStessaRichiestaConEsistenti()
    {
        var client = factory.CreateClient();
        await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("mix-1", Base) });

        var esistente = NuovoEvento("mix-1", Dopo());
        esistente.NomeEvento = "Ignorato";
        var risposta = await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { esistente, NuovoEvento("mix-2", Base) });

        Assert.Equal(HttpStatusCode.Forbidden, risposta.StatusCode);

        Assert.Equal("Sagra mix-1", (await LeggiDalDb("mix-1"))!.NomeEvento);
        Assert.NotNull(await LeggiDalDb("mix-2"));
    }

    [Fact]
    public async Task Put_AdminPuoModificareEventiEsistenti()
    {
        var anonimo = factory.CreateClient();
        await anonimo.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("adm-1", Base) });
        var client = await ClientConRuoloAsync(Ruoli.Admin);

        var modificato = NuovoEvento("adm-1", Dopo());
        modificato.NomeEvento = "Da admin";
        await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { modificato });

        Assert.Equal("Da admin", (await LeggiDalDb("adm-1"))!.NomeEvento);
    }

    // ---------- 7-ter: only the server decides the conclusion ----------

    [Theory]
    [InlineData(Ruoli.Editor)]
    [InlineData(Ruoli.Admin)]
    public async Task Put_UnClientNonPuoConcludereUnEventoEsistente(string ruolo)
    {
        var client = await ClientConRuoloAsync(ruolo);
        var id = $"conc-client-{ruolo}";
        await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento(id, Base) });

        var modificato = NuovoEvento(id, Dopo(), concluso: true);
        modificato.NomeEvento = "Nome nuovo";
        var risposta = await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { modificato });

        Assert.Equal(HttpStatusCode.OK, risposta.StatusCode);
        var salvato = (await LeggiDalDb(id))!;
        Assert.False(salvato.EventoConcluso);
        Assert.Equal("Nome nuovo", salvato.NomeEvento); // the details remain editable
    }

    [Fact]
    public async Task Put_UnAnonimoNonPuoConcludereUnEventoEsistente()
    {
        var client = factory.CreateClient();
        var evento = NuovoEvento("conc-anon", Base);
        (await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { evento })).EnsureSuccessStatusCode();

        evento.EventoConcluso = true;
        var risposta = await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { evento });

        Assert.Equal(HttpStatusCode.OK, risposta.StatusCode); // same content: harmless re-send, the flag is ignored
        Assert.False((await LeggiDalDb("conc-anon"))!.EventoConcluso);
    }

    [Theory]
    [InlineData(Ruoli.Editor)]
    [InlineData(Ruoli.Admin)]
    public async Task Put_UnEventoConclusoNonSiModificaPiuNemmenoDaStaff(string ruolo)
    {
        await ImpostaStatoAsync($"conc-fermo-{ruolo}", StatoModerazione.Approvato, concluso: true);
        var client = await ClientConRuoloAsync(ruolo);

        var modificato = NuovoEvento($"conc-fermo-{ruolo}", Dopo());
        modificato.NomeEvento = "Da ignorare";
        var risposta = await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { modificato });

        Assert.Equal(HttpStatusCode.OK, risposta.StatusCode);
        var salvato = (await LeggiDalDb($"conc-fermo-{ruolo}"))!;
        Assert.Equal($"Contenuto conc-fermo-{ruolo}", salvato.NomeEvento);
        Assert.True(salvato.EventoConcluso);
    }

    [Fact]
    public async Task Put_UnEventoConclusoNonPuoEssereRiapertoDaStaff()
    {
        await ImpostaStatoAsync("conc-riapri", StatoModerazione.Approvato, concluso: true);
        var admin = await ClientConRuoloAsync(Ruoli.Admin);

        await admin.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("conc-riapri", Dopo(), concluso: false) });

        Assert.True((await LeggiDalDb("conc-riapri"))!.EventoConcluso);
    }

    [Fact]
    public async Task Put_RifiutaEventoNonValido()
    {
        var client = factory.CreateClient();
        var invalido = NuovoEvento("invalid-1", Base);
        invalido.NomeEvento = "";

        var response = await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { invalido });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Null(await LeggiDalDb("invalid-1"));
    }

    /// <summary>Fields longer than the maximum length are rejected with 400 and nothing is stored.</summary>
    [Theory]
    [InlineData("Id", EventoModel.MaxIdLength)]
    [InlineData("NomeEvento", EventoModel.MaxNomeLength)]
    [InlineData("CittaEvento", EventoModel.MaxCittaLength)]
    [InlineData("DescrizioneEvento", EventoModel.MaxDescrizioneLength)]
    public async Task Put_RifiutaCampiTroppoLunghi(string campo, int massimo)
    {
        var client = factory.CreateClient();
        var evento = NuovoEvento("long-1", Base);
        var troppoLungo = new string('a', massimo + 1);
        switch (campo)
        {
            case "Id": evento.Id = troppoLungo; break;
            case "NomeEvento": evento.NomeEvento = troppoLungo; break;
            case "CittaEvento": evento.CittaEvento = troppoLungo; break;
            default: evento.DescrizioneEvento = troppoLungo; break;
        }

        var response = await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { evento });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Null(await LeggiDalDb(evento.Id));
    }

    /// <summary>Fields exactly at the maximum length are accepted.</summary>
    [Fact]
    public async Task Put_AccettaCampiAlLimiteDiLunghezza()
    {
        var client = factory.CreateClient();
        var evento = NuovoEvento(new string('i', EventoModel.MaxIdLength), Base);
        evento.NomeEvento = new string('n', EventoModel.MaxNomeLength);
        evento.CittaEvento = new string('c', EventoModel.MaxCittaLength);
        evento.DescrizioneEvento = new string('d', EventoModel.MaxDescrizioneLength);

        var response = await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { evento });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(await LeggiDalDb(evento.Id));
    }

    [Fact]
    public async Task Put_RifiutaEventoSenzaId()
    {
        var client = factory.CreateClient();

        var response = await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("", Base) });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Get_RestituisceGliEventiModificatiDopoSince()
    {
        var client = await ClientConRuoloAsync(Ruoli.Editor);
        await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("get-1", Base) });

        var eventi = await client.GetFromJsonAsync<List<EventoModel>>(Url(Passato));

        Assert.NotNull(eventi);
        Assert.Contains(eventi, e => e.Id == "get-1");
    }

    [Fact]
    public async Task Get_LaCacheDistingueValoriDiSinceDiversi()
    {
        var client = await ClientConRuoloAsync(Ruoli.Editor);
        await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("cache-1", Base) });

        var tutti = await client.GetFromJsonAsync<List<EventoModel>>(Url(Passato));
        var recenti = await client.GetFromJsonAsync<List<EventoModel>>(Url(DateTime.UtcNow.AddDays(1)));

        Assert.Contains(tutti!, e => e.Id == "cache-1");
        Assert.DoesNotContain(recenti!, e => e.Id == "cache-1");
    }

    [Fact]
    public async Task Get_DopoUnaModificaNonRestituisceDatiVecchiDellaCache()
    {
        var client = await ClientConRuoloAsync(Ruoli.Editor);
        await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("cache-2", Base) });
        await client.GetFromJsonAsync<List<EventoModel>>(Url(Passato));

        var modificato = NuovoEvento("cache-2", Dopo());
        modificato.NomeEvento = "Nome aggiornato";
        await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { modificato });
        var eventi = await client.GetFromJsonAsync<List<EventoModel>>(Url(Passato));

        Assert.Equal("Nome aggiornato", eventi!.Single(e => e.Id == "cache-2").NomeEvento);
    }

    [Fact]
    public async Task Put_IlServerImpostaIlTimestampEIgnoraQuelloFuturoDelClient()
    {
        var client = factory.CreateClient();
        var prima = DateTime.UtcNow;

        await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("ts-1", new DateTime(2099, 1, 1, 0, 0, 0, DateTimeKind.Utc)) });

        var salvato = await LeggiDalDb("ts-1");
        Assert.InRange(salvato!.DataOraUltimaModifica, prima.AddSeconds(-1), DateTime.UtcNow.AddSeconds(1));
    }

    [Fact]
    public async Task Put_UnaModificaImpostaIlTimestampDelServer()
    {
        var client = await ClientConRuoloAsync(Ruoli.Editor);
        await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("ts-2", Base) });

        await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("ts-2", new DateTime(2099, 1, 1, 0, 0, 0, DateTimeKind.Utc)) });

        Assert.True((await LeggiDalDb("ts-2"))!.DataOraUltimaModifica < DateTime.UtcNow.AddMinutes(1));
    }

    [Fact]
    public async Task Put_IdDuplicatiNelloStessoBatchNonDannoErrore()
    {
        var client = factory.CreateClient();
        var primo = NuovoEvento("dup-1", Base);
        var secondo = NuovoEvento("dup-1", Base.AddMinutes(1));
        secondo.NomeEvento = "Secondo";

        var response = await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { primo, secondo });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Secondo", (await LeggiDalDb("dup-1"))!.NomeEvento);
    }

    [Fact]
    public async Task Put_RifiutaPiuEventiDelMassimoPerRichiesta()
    {
        var client = factory.CreateClient();
        var troppi = Enumerable.Range(0, 21).Select(i => NuovoEvento($"max-{i}", Base)).ToArray();

        var response = await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", troppi);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Null(await LeggiDalDb("max-0"));
    }

    [Fact]
    public async Task Put_AccettaIlMassimoDiEventiPerRichiesta()
    {
        var client = factory.CreateClient();
        var eventi = Enumerable.Range(0, 20).Select(i => NuovoEvento($"okmax-{i}", Base)).ToArray();

        var response = await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", eventi);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(await LeggiDalDb("okmax-19"));
    }

    [Fact]
    public async Task Put_OltreIlLimiteDiRichiesteRispondeConTooManyRequests()
    {
        using var limitata = factory.WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, config) =>
            config.AddInMemoryCollection(new Dictionary<string, string?> { ["Eventi:RichiestePutAlMinuto"] = "2" })));
        var client = limitata.CreateClient();

        var risposte = new List<HttpStatusCode>();
        for (var i = 0; i < 3; i++)
        {
            risposte.Add((await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento($"rl-{i}", Base) })).StatusCode);
        }

        Assert.Equal([HttpStatusCode.OK, HttpStatusCode.OK, HttpStatusCode.TooManyRequests], risposte);
    }

    [Fact]
    public async Task Put_AnonimoInserisceEventiInAttesa()
    {
        var client = factory.CreateClient();

        await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("mod-1", Base) });

        Assert.Equal(StatoModerazione.InAttesa, (await LeggiDalDb("mod-1"))!.Stato);
    }

    [Theory]
    [InlineData(Ruoli.Editor)]
    [InlineData(Ruoli.Admin)]
    public async Task Put_EditorEAdminInserisconoEventiApprovati(string ruolo)
    {
        var client = await ClientConRuoloAsync(ruolo);

        await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento($"mod-{ruolo}", Base) });

        Assert.Equal(StatoModerazione.Approvato, (await LeggiDalDb($"mod-{ruolo}"))!.Stato);
    }

    [Fact]
    public async Task Put_UtenteSenzaRuoloInserisceEventiInAttesa()
    {
        var client = await ClientConRuoloAsync(null);

        await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("mod-norole", Base) });

        Assert.Equal(StatoModerazione.InAttesa, (await LeggiDalDb("mod-norole"))!.Stato);
    }

    [Fact]
    public async Task Put_LoStatoInviatoDalClientAnonimoEIgnorato()
    {
        var client = factory.CreateClient();
        var evento = NuovoEvento("mod-spoof", Base);
        evento.Stato = StatoModerazione.Approvato;
        evento.MotivoRifiuto = "x";

        await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { evento });

        var salvato = await LeggiDalDb("mod-spoof");
        Assert.Equal(StatoModerazione.InAttesa, salvato!.Stato);
        Assert.Null(salvato.MotivoRifiuto);
    }

    [Fact]
    public async Task Put_UnaModificaDelRevisoreNonCambiaLoStato()
    {
        var anonimo = factory.CreateClient();
        await anonimo.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("mod-keep", Base) });
        var editor = await ClientConRuoloAsync(Ruoli.Editor);

        var modificato = NuovoEvento("mod-keep", Dopo());
        modificato.Stato = StatoModerazione.Approvato;
        await editor.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { modificato });

        Assert.Equal(StatoModerazione.InAttesa, (await LeggiDalDb("mod-keep"))!.Stato);
    }

    [Fact]
    public async Task Get_NonRestituisceEventiInAttesaNeRifiutati()
    {
        var client = factory.CreateClient();
        await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("vis-attesa", Base) });
        await ImpostaStatoAsync("vis-attesa-r", StatoModerazione.Rifiutato, concluso: false);

        var eventi = await client.GetFromJsonAsync<List<EventoModel>>(Url(Passato));

        Assert.DoesNotContain(eventi!, e => e.Id == "vis-attesa" || e.Id == "vis-attesa-r");
    }

    [Fact]
    public async Task Get_RestituisceGliEventiApprovati()
    {
        var editor = await ClientConRuoloAsync(Ruoli.Editor);
        await editor.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("vis-ok", Base) });

        var eventi = await factory.CreateClient().GetFromJsonAsync<List<EventoModel>>(Url(Passato));

        var evento = eventi!.Single(e => e.Id == "vis-ok");
        Assert.Equal(StatoModerazione.Approvato, evento.Stato);
        Assert.Equal("Sagra vis-ok", evento.NomeEvento);
    }

    [Fact]
    public async Task Get_UnEventoRitiratoEsceComeTombstoneSenzaContenuto()
    {
        await ImpostaStatoAsync("vis-ritirato", StatoModerazione.Rifiutato, concluso: true);

        var eventi = await factory.CreateClient().GetFromJsonAsync<List<EventoModel>>(Url(Passato));

        var tomb = eventi!.Single(e => e.Id == "vis-ritirato");
        Assert.True(tomb.EventoConcluso);
        Assert.Equal(string.Empty, tomb.NomeEvento);
        Assert.Equal(string.Empty, tomb.DescrizioneEvento);
        Assert.Null(tomb.MotivoRifiuto);
    }

    [Fact]
    public async Task Get_UnEventoInAttesaScadutoNonEsce()
    {
        await ImpostaStatoAsync("vis-scaduto", StatoModerazione.InAttesa, concluso: true);

        var eventi = await factory.CreateClient().GetFromJsonAsync<List<EventoModel>>(Url(Passato));

        Assert.DoesNotContain(eventi!, e => e.Id == "vis-scaduto");
    }

    private async Task ImpostaStatoAsync(string id, StatoModerazione stato, bool concluso)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Eventi.Add(new Evento
        {
            Id = id,
            NomeEvento = "Contenuto " + id,
            CittaEvento = "Verona",
            DataInizioEvento = new DateTime(2026, 7, 1),
            DataFineEvento = new DateTime(2026, 7, 3),
            DescrizioneEvento = "Contenuto da non mostrare",
            EventoConcluso = concluso,
            DataOraUltimaModifica = DateTime.UtcNow,
            Stato = stato,
            MotivoRifiuto = stato == StatoModerazione.Rifiutato ? "spam" : null,
        });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task Get_RispondeConUnaListaVuotaSeNonCiSonoEventi()
    {
        using var isolata = new ApiFactory();
        var client = isolata.CreateClient();

        var eventi = await client.GetFromJsonAsync<List<EventoModel>>(Url(Passato));

        Assert.NotNull(eventi);
        Assert.Empty(eventi);
    }

    // ---------- Moderation M3: review endpoints and GetStati ----------

    private async Task<List<EventoModel>> PubblicoAsync() =>
        (await factory.CreateClient().GetFromJsonAsync<List<EventoModel>>(Url(Passato)))!;

    [Fact]
    public async Task Revisione_DaRivedere_RichiedeAutenticazioneERuolo()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync("/api/Eventi/Revisione/DaRivedere")).StatusCode);
        var senzaRuolo = await ClientConRuoloAsync(null);
        Assert.Equal(HttpStatusCode.Forbidden, (await senzaRuolo.GetAsync("/api/Eventi/Revisione/DaRivedere")).StatusCode);
    }

    [Fact]
    public async Task Revisione_ApprovaERifiuta_SonoNegatiAGliNonAutorizzati()
    {
        await ImpostaStatoAsync("rev-neg", StatoModerazione.InAttesa, concluso: false);
        var richiestaApprova = new ApprovaEventiRequest { Ids = ["rev-neg"] };
        var richiestaRifiuta = new RifiutaEventiRequest { Ids = ["rev-neg"], Motivo = "spam" };

        var anonimo = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonimo.PostAsJsonAsync("/api/Eventi/Revisione/Approva", richiestaApprova)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonimo.PostAsJsonAsync("/api/Eventi/Revisione/Rifiuta", richiestaRifiuta)).StatusCode);

        var senzaRuolo = await ClientConRuoloAsync(null);
        Assert.Equal(HttpStatusCode.Forbidden, (await senzaRuolo.PostAsJsonAsync("/api/Eventi/Revisione/Approva", richiestaApprova)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await senzaRuolo.PostAsJsonAsync("/api/Eventi/Revisione/Rifiuta", richiestaRifiuta)).StatusCode);

        Assert.Equal(StatoModerazione.InAttesa, (await LeggiDalDb("rev-neg"))!.Stato);
    }

    [Theory]
    [InlineData(Ruoli.Editor)]
    [InlineData(Ruoli.Admin)]
    public async Task Revisione_DaRivedere_ElencaGliEventiInAttesaEIRifiutatiConMotivo(string ruolo)
    {
        await ImpostaStatoAsync($"dr-attesa-{ruolo}", StatoModerazione.InAttesa, concluso: false);
        await ImpostaStatoAsync($"dr-rifiutato-{ruolo}", StatoModerazione.Rifiutato, concluso: false);
        await ImpostaStatoAsync($"dr-approvato-{ruolo}", StatoModerazione.Approvato, concluso: false);
        var client = await ClientConRuoloAsync(ruolo);

        var inAttesa = await client.GetFromJsonAsync<List<EventoModel>>("/api/Eventi/Revisione/DaRivedere");
        var rifiutati = await client.GetFromJsonAsync<List<EventoModel>>("/api/Eventi/Revisione/DaRivedere?stato=Rifiutato");

        Assert.All(inAttesa!, e => Assert.Equal(StatoModerazione.InAttesa, e.Stato));
        Assert.Contains(inAttesa!, e => e.Id == $"dr-attesa-{ruolo}" && e.NomeEvento == $"Contenuto dr-attesa-{ruolo}");
        Assert.DoesNotContain(inAttesa!, e => e.Id == $"dr-rifiutato-{ruolo}" || e.Id == $"dr-approvato-{ruolo}");
        Assert.All(rifiutati!, e => Assert.Equal(StatoModerazione.Rifiutato, e.Stato));
        Assert.Equal("spam", rifiutati!.Single(e => e.Id == $"dr-rifiutato-{ruolo}").MotivoRifiuto);
    }

    [Fact]
    public async Task Revisione_DaRivedere_RifiutaLoStatoApprovato()
    {
        var client = await ClientConRuoloAsync(Ruoli.Editor);

        var risposta = await client.GetAsync("/api/Eventi/Revisione/DaRivedere?stato=Approvato");

        Assert.Equal(HttpStatusCode.BadRequest, risposta.StatusCode);
    }

    [Fact]
    public async Task Revisione_Conclusi_SoloAdmin()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync("/api/Eventi/Revisione/Conclusi")).StatusCode);
        var senzaRuolo = await ClientConRuoloAsync(null);
        Assert.Equal(HttpStatusCode.Forbidden, (await senzaRuolo.GetAsync("/api/Eventi/Revisione/Conclusi")).StatusCode);
        var editor = await ClientConRuoloAsync(Ruoli.Editor);
        Assert.Equal(HttpStatusCode.Forbidden, (await editor.GetAsync("/api/Eventi/Revisione/Conclusi")).StatusCode);
    }

    [Fact]
    public async Task Revisione_Conclusi_ElencaGliEventiConclusiInOgniStatoConIlContenuto()
    {
        await ImpostaStatoAsync("conc-approvato", StatoModerazione.Approvato, concluso: true);
        await ImpostaStatoAsync("conc-attesa", StatoModerazione.InAttesa, concluso: true);
        await ImpostaStatoAsync("conc-ritirato", StatoModerazione.Rifiutato, concluso: true);
        await ImpostaStatoAsync("conc-aperto", StatoModerazione.Approvato, concluso: false);
        var admin = await ClientConRuoloAsync(Ruoli.Admin);

        var conclusi = await admin.GetFromJsonAsync<List<EventoModel>>("/api/Eventi/Revisione/Conclusi");

        Assert.All(conclusi!, e => Assert.True(e.EventoConcluso));
        Assert.Equal(StatoModerazione.Approvato, conclusi!.Single(e => e.Id == "conc-approvato").Stato);
        Assert.Equal(StatoModerazione.InAttesa, conclusi!.Single(e => e.Id == "conc-attesa").Stato);
        var ritirato = conclusi!.Single(e => e.Id == "conc-ritirato");
        Assert.Equal("Contenuto conc-ritirato", ritirato.NomeEvento);
        Assert.Equal("spam", ritirato.MotivoRifiuto);
        Assert.DoesNotContain(conclusi!, e => e.Id == "conc-aperto");
    }

    [Fact]
    public async Task Revisione_Approva_RendeVisibileLEventoAnonimoEInvalidaLaCache()
    {
        var anonimo = factory.CreateClient();
        (await anonimo.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("app-1", Prima()) })).EnsureSuccessStatusCode();
        var iniziale = DateTime.UtcNow.AddSeconds(-1);
        Assert.DoesNotContain(await PubblicoAsync(), e => e.Id == "app-1"); // fills the cache

        var editor = await ClientConRuoloAsync(Ruoli.Editor);
        var risposta = await editor.PostAsJsonAsync("/api/Eventi/Revisione/Approva", new ApprovaEventiRequest { Ids = ["app-1"] });

        risposta.EnsureSuccessStatusCode();
        Assert.Equal(1, (await risposta.Content.ReadFromJsonAsync<RevisioneEsito>())!.Modificati);
        var visibile = (await PubblicoAsync()).Single(e => e.Id == "app-1");
        Assert.Equal(StatoModerazione.Approvato, visibile.Stato);
        Assert.Equal("Sagra app-1", visibile.NomeEvento);
        Assert.True(visibile.DataOraUltimaModifica > iniziale);
        var salvato = (await LeggiDalDb("app-1"))!;
        Assert.Equal("editor@test.local", salvato.RevisionatoDa);
        Assert.NotNull(salvato.DataRevisione);
    }

    [Fact]
    public async Task Revisione_Approva_AccettaPiuIdEIgnoraSconosciutiEGiaApprovati()
    {
        await ImpostaStatoAsync("multi-1", StatoModerazione.InAttesa, concluso: false);
        await ImpostaStatoAsync("multi-2", StatoModerazione.InAttesa, concluso: false);
        await ImpostaStatoAsync("multi-3", StatoModerazione.Approvato, concluso: false);
        var admin = await ClientConRuoloAsync(Ruoli.Admin);

        var risposta = await admin.PostAsJsonAsync("/api/Eventi/Revisione/Approva",
            new ApprovaEventiRequest { Ids = ["multi-1", "multi-2", "multi-3", "multi-1", "non-esiste"] });

        risposta.EnsureSuccessStatusCode();
        Assert.Equal(2, (await risposta.Content.ReadFromJsonAsync<RevisioneEsito>())!.Modificati);
        Assert.Equal(StatoModerazione.Approvato, (await LeggiDalDb("multi-1"))!.Stato);
        Assert.Equal(StatoModerazione.Approvato, (await LeggiDalDb("multi-2"))!.Stato);
    }

    [Fact]
    public async Task Revisione_Approva_UnEventoRifiutatoTornaApprovatoSenzaMotivo()
    {
        await ImpostaStatoAsync("riapp-1", StatoModerazione.Rifiutato, concluso: true);
        var editor = await ClientConRuoloAsync(Ruoli.Editor);

        (await editor.PostAsJsonAsync("/api/Eventi/Revisione/Approva", new ApprovaEventiRequest { Ids = ["riapp-1"] })).EnsureSuccessStatusCode();

        var evento = (await LeggiDalDb("riapp-1"))!;
        Assert.Equal(StatoModerazione.Approvato, evento.Stato);
        Assert.Null(evento.MotivoRifiuto);
    }

    [Fact]
    public async Task Revisione_Approva_ValidaGliId()
    {
        var editor = await ClientConRuoloAsync(Ruoli.Editor);

        Assert.Equal(HttpStatusCode.BadRequest,
            (await editor.PostAsJsonAsync("/api/Eventi/Revisione/Approva", new ApprovaEventiRequest())).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await editor.PostAsJsonAsync("/api/Eventi/Revisione/Approva", new ApprovaEventiRequest { Ids = [" "] })).StatusCode);
        var troppi = Enumerable.Range(0, 101).Select(i => $"x-{i}").ToList();
        Assert.Equal(HttpStatusCode.BadRequest,
            (await editor.PostAsJsonAsync("/api/Eventi/Revisione/Approva", new ApprovaEventiRequest { Ids = troppi })).StatusCode);
    }

    [Fact]
    public async Task Revisione_Rifiuta_IlMotivoELimitatoMaNonObbligatorio()
    {
        await ImpostaStatoAsync("rif-motivo", StatoModerazione.InAttesa, concluso: false);
        var editor = await ClientConRuoloAsync(Ruoli.Editor);

        var lungo = await editor.PostAsJsonAsync("/api/Eventi/Revisione/Rifiuta",
            new RifiutaEventiRequest { Ids = ["rif-motivo"], Motivo = new string('a', 501) });

        Assert.Equal(HttpStatusCode.BadRequest, lungo.StatusCode);
        Assert.Equal(StatoModerazione.InAttesa, (await LeggiDalDb("rif-motivo"))!.Stato);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Revisione_Rifiuta_SenzaMotivoRifiutaSalvandoNulla(string? motivo)
    {
        var id = $"rif-senza-{motivo?.Length ?? -1}";
        await ImpostaStatoAsync(id, StatoModerazione.InAttesa, concluso: false);
        var editor = await ClientConRuoloAsync(Ruoli.Editor);

        var risposta = await editor.PostAsJsonAsync("/api/Eventi/Revisione/Rifiuta", new RifiutaEventiRequest { Ids = [id], Motivo = motivo! });

        Assert.Equal(HttpStatusCode.OK, risposta.StatusCode);
        Assert.Equal(1, (await risposta.Content.ReadFromJsonAsync<RevisioneEsito>())!.Modificati);
        var evento = (await LeggiDalDb(id))!;
        Assert.Equal(StatoModerazione.Rifiutato, evento.Stato);
        Assert.Null(evento.MotivoRifiuto);
    }

    [Fact]
    public async Task Revisione_Rifiuta_RitiroDiUnApprovatoSenzaMotivoDiventaUnTombstone()
    {
        var editor = await ClientConRuoloAsync(Ruoli.Editor);
        (await editor.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("ritiro-senza", Prima()) })).EnsureSuccessStatusCode();
        var prima = DateTime.UtcNow.AddSeconds(-1);

        (await editor.PostAsJsonAsync("/api/Eventi/Revisione/Rifiuta", new RifiutaEventiRequest { Ids = ["ritiro-senza"] })).EnsureSuccessStatusCode();

        var tomb = (await factory.CreateClient().GetFromJsonAsync<List<EventoModel>>(Url(prima)))!.Single(e => e.Id == "ritiro-senza");
        Assert.True(tomb.EventoConcluso);
        Assert.Equal(string.Empty, tomb.NomeEvento);
        Assert.Null((await LeggiDalDb("ritiro-senza"))!.MotivoRifiuto);
    }

    [Fact]
    public async Task Revisione_Rifiuta_UnEventoInAttesaResteNascostoEIlSegnalanteNonVieneAvvisatoDelRifiuto()
    {
        await ImpostaStatoAsync("rif-1", StatoModerazione.InAttesa, concluso: false);
        var editor = await ClientConRuoloAsync(Ruoli.Editor);

        var risposta = await editor.PostAsJsonAsync("/api/Eventi/Revisione/Rifiuta",
            new RifiutaEventiRequest { Ids = ["rif-1"], Motivo = "  Contenuto non pertinente " });

        risposta.EnsureSuccessStatusCode();
        Assert.Equal(1, (await risposta.Content.ReadFromJsonAsync<RevisioneEsito>())!.Modificati);
        var evento = (await LeggiDalDb("rif-1"))!;
        Assert.Equal(StatoModerazione.Rifiutato, evento.Stato);
        Assert.False(evento.EventoConcluso);
        Assert.Equal("Contenuto non pertinente", evento.MotivoRifiuto);
        Assert.Equal("editor@test.local", evento.RevisionatoDa);
        Assert.DoesNotContain(await PubblicoAsync(), e => e.Id == "rif-1");

        var stati = await factory.CreateClient().GetFromJsonAsync<List<StatoEventoModel>>("/api/Eventi/GetStati?ids=rif-1");
        // For the reporter the rejection does not exist: it stays "pending" and the note does not come out (it stays in the database as history)
        var stato = Assert.Single(stati!);
        Assert.Equal(StatoModerazione.InAttesa, stato.Stato);
        var grezzo = await factory.CreateClient().GetStringAsync("/api/Eventi/GetStati?ids=rif-1");
        Assert.DoesNotContain("Contenuto non pertinente", grezzo);
        Assert.DoesNotContain("otivoRifiuto", grezzo);
        Assert.Equal("Contenuto non pertinente", (await LeggiDalDb("rif-1"))!.MotivoRifiuto);
    }

    [Fact]
    public async Task Revisione_Rifiuta_UnEventoApprovatoDiventaUnTombstone()
    {
        var editor = await ClientConRuoloAsync(Ruoli.Editor);
        (await editor.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("ritiro-1", Prima()) })).EnsureSuccessStatusCode();
        var prima = DateTime.UtcNow.AddSeconds(-1);
        Assert.Contains(await PubblicoAsync(), e => e.Id == "ritiro-1" && !e.EventoConcluso);

        var risposta = await editor.PostAsJsonAsync("/api/Eventi/Revisione/Rifiuta",
            new RifiutaEventiRequest { Ids = ["ritiro-1"], Motivo = "Evento annullato" });

        risposta.EnsureSuccessStatusCode();
        var eventi = await factory.CreateClient().GetFromJsonAsync<List<EventoModel>>(Url(prima));
        var tomb = eventi!.Single(e => e.Id == "ritiro-1");
        Assert.True(tomb.EventoConcluso);
        Assert.Equal(string.Empty, tomb.NomeEvento);
        Assert.Equal(string.Empty, tomb.DescrizioneEvento);
        Assert.Null(tomb.MotivoRifiuto);
        Assert.Equal(StatoModerazione.Rifiutato, (await LeggiDalDb("ritiro-1"))!.Stato);
    }

    [Fact]
    public async Task Revisione_Rifiuta_AdminPuoRitirareEIdGiaRifiutatiSonoIgnorati()
    {
        await ImpostaStatoAsync("rif-admin", StatoModerazione.Approvato, concluso: false);
        await ImpostaStatoAsync("rif-gia", StatoModerazione.Rifiutato, concluso: false);
        var admin = await ClientConRuoloAsync(Ruoli.Admin);

        var risposta = await admin.PostAsJsonAsync("/api/Eventi/Revisione/Rifiuta",
            new RifiutaEventiRequest { Ids = ["rif-admin", "rif-gia"], Motivo = "Duplicato" });

        Assert.Equal(1, (await risposta.Content.ReadFromJsonAsync<RevisioneEsito>())!.Modificati);
        Assert.Equal("spam", (await LeggiDalDb("rif-gia"))!.MotivoRifiuto);
        Assert.True((await LeggiDalDb("rif-admin"))!.EventoConcluso);
    }

    /// <summary>GetStati rejects too many ids, and ids longer than the maximum event id length.</summary>
    [Theory]
    [InlineData(51, 10)]
    [InlineData(1, EventoModel.MaxIdLength + 1)]
    public async Task GetStati_RifiutaTroppiIdOIdTroppoLunghi(int quanti, int lunghezza)
    {
        var ids = Enumerable.Range(0, quanti).Select(i => i.ToString().PadLeft(lunghezza, 'a'));
        var query = string.Join("&", ids.Select(id => "ids=" + id));

        var response = await factory.CreateClient().GetAsync("/api/Eventi/GetStati?" + query);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    /// <summary>GetStati accepts ids of exactly the maximum length.</summary>
    [Fact]
    public async Task GetStati_AccettaIdAlLimiteDiLunghezza()
    {
        var response = await factory.CreateClient().GetAsync("/api/Eventi/GetStati?ids=" + new string('a', EventoModel.MaxIdLength));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetStati_EsponeSoloLoStatoDegliIdRichiestiENascondeIlRifiuto()
    {
        await ImpostaStatoAsync("st-attesa", StatoModerazione.InAttesa, concluso: false);
        await ImpostaStatoAsync("st-appr", StatoModerazione.Approvato, concluso: false);
        await ImpostaStatoAsync("st-rif", StatoModerazione.Rifiutato, concluso: false);

        var stati = await factory.CreateClient()
            .GetFromJsonAsync<List<StatoEventoModel>>("/api/Eventi/GetStati?ids=st-attesa&ids=st-appr&ids=st-rif&ids=non-esiste");

        Assert.Equal(3, stati!.Count);
        Assert.Equal(StatoModerazione.InAttesa, stati.Single(s => s.Id == "st-attesa").Stato);
        Assert.Equal(StatoModerazione.Approvato, stati.Single(s => s.Id == "st-appr").Stato);
        // A rejected event ("spam" in the database) appears as a pending one
        Assert.Equal(StatoModerazione.InAttesa, stati.Single(s => s.Id == "st-rif").Stato);
    }

    [Fact]
    public async Task GetStati_ValidaIlNumeroDiId()
    {
        var client = factory.CreateClient();

        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/Eventi/GetStati")).StatusCode);
        var troppi = string.Join("&", Enumerable.Range(0, 51).Select(i => $"ids=x-{i}"));
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync($"/api/Eventi/GetStati?{troppi}")).StatusCode);
    }
}
