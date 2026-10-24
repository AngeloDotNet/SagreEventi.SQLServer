using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SagreEventi.Shared.Models;
using SagreEventi.Web.Server.Models.Services.Infrastructure;

namespace SagreEventi.Web.Server.Tests;

/// <summary>Security tests with malicious input: injection, scripts, malformed bodies, no internal details in the errors.</summary>
public class SicurezzaInputTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string TentativoSql = "x'); DROP TABLE Eventi; --";
    private const string TentativoXss = "<script>alert('xss')</script><img src=x onerror=alert(1)>";
    private const string OrSempreVero = "' OR '1'='1";

    private static EventoModel NuovoEvento(string id) => new()
    {
        Id = id,
        NomeEvento = "Sagra " + id,
        CittaEvento = "Verona",
        DataInizioEvento = new DateTime(2026, 7, 1),
        DataFineEvento = new DateTime(2026, 7, 3),
        DescrizioneEvento = "Descrizione",
    };

    private async Task<int> ContaEventiAsync()
    {
        using var scope = factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<AppDbContext>().Eventi.CountAsync();
    }

    // Login is limited to 10 per minute per IP and xUnit creates one instance per test: the Admin token is obtained once per factory
    private static readonly Dictionary<ApiFactory, string> TokenAdmin = [];
    private static readonly SemaphoreSlim LoginLock = new(1, 1);

    private async Task<HttpClient> ConTokenAdminAsync()
    {
        var client = factory.CreateClient();
        await LoginLock.WaitAsync();
        try
        {
            if (!TokenAdmin.TryGetValue(factory, out var token))
            {
                var login = await client.PostAsJsonAsync("/api/auth/login", new { email = ApiFactory.AdminEmail, password = ApiFactory.AdminPassword });
                login.EnsureSuccessStatusCode();
                using var doc = JsonDocument.Parse(await login.Content.ReadAsStringAsync());
                token = doc.RootElement.GetProperty("accessToken").GetString() ?? throw new InvalidOperationException("accessToken mancante");
                TokenAdmin[factory] = token;
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
    public async Task Put_UnTentativoDiSqlInjectionEMemorizzatoComeTesto()
    {
        var evento = NuovoEvento("sqli-1");
        evento.NomeEvento = TentativoSql;
        evento.DescrizioneEvento = TentativoSql;

        var response = await factory.CreateClient().PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { evento });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var scope = factory.Services.CreateScope();
        var salvato = await scope.ServiceProvider.GetRequiredService<AppDbContext>().Eventi.FindAsync("sqli-1");
        Assert.Equal(TentativoSql, salvato!.NomeEvento);
    }

    [Fact]
    public async Task Put_IdConSqlInjectionInserisceUnSoloEvento()
    {
        var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("sqli-base") })).StatusCode);
        var prima = await ContaEventiAsync();

        var response = await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento(OrSempreVero) });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(prima + 1, await ContaEventiAsync());
    }

    [Fact]
    public async Task GetStati_IdConSqlInjectionNonRestituisceNulla()
    {
        var client = factory.CreateClient();
        await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("stati-sqli") });

        var response = await client.GetAsync("/api/Eventi/GetStati?ids=" + Uri.EscapeDataString(OrSempreVero + " --"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("[]", (await response.Content.ReadAsStringAsync()).Trim());
    }

    [Fact]
    public async Task GetEventi_UnPayloadConScriptEDatoJsonEscapatoENonHtml()
    {
        var client = factory.CreateClient();
        var evento = NuovoEvento("xss-1");
        evento.NomeEvento = TentativoXss;
        evento.DescrizioneEvento = TentativoXss;
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { evento })).StatusCode);

        // Only approved events are public: approve it directly in the database
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            (await db.Eventi.FindAsync("xss-1"))!.Stato = StatoModerazione.Approvato;
            await db.SaveChangesAsync();
        }

        var risposta = await client.GetAsync("/api/Eventi/GetEventi");
        var corpo = await risposta.Content.ReadAsStringAsync();

        Assert.Equal("application/json", risposta.Content.Headers.ContentType?.MediaType);
        Assert.Contains("nosniff", risposta.Headers.GetValues("X-Content-Type-Options"));
        Assert.DoesNotContain("<script>", corpo);
        var opzioni = new JsonSerializerOptions(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };
        Assert.Contains(JsonSerializer.Deserialize<List<EventoModel>>(corpo, opzioni)!, e => e.Id == "xss-1" && e.NomeEvento == TentativoXss);
    }

    [Theory]
    [InlineData("{ non è json")]
    [InlineData("[{\"Id\": ")]
    [InlineData("{\"eventi\": 1}")]
    [InlineData("[{\"DataInizioEvento\": \"non-una-data\"}]")]
    public async Task Put_BodyMalformatoDa400SenzaDettagliInterni(string corpo)
    {
        var response = await factory.CreateClient()
            .PutAsync("/api/Eventi/UpdateEventi", new StringContent(corpo, Encoding.UTF8, "application/json"));
        var testo = await response.Content.ReadAsStringAsync();

        Assert.True(response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.UnsupportedMediaType, $"Status: {response.StatusCode}");
        Assert.DoesNotContain("Exception", testo);
        Assert.DoesNotContain("   at ", testo);
        Assert.DoesNotContain("SagreEventi.Web.Server", testo);
    }

    [Fact]
    public async Task Put_ElementoNullNellaListaDa400()
    {
        var response = await factory.CreateClient()
            .PutAsync("/api/Eventi/UpdateEventi", new StringContent("[null]", Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetEventi_SinceNonValidoDa400SenzaDettagliInterni()
    {
        var response = await factory.CreateClient().GetAsync("/api/Eventi/GetEventi?since=" + Uri.EscapeDataString(OrSempreVero + " --"));
        var testo = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.DoesNotContain("   at ", testo);
    }

    [Fact]
    public async Task Login_ConSqlInjectionNonDaErroreDelServer()
    {
        var response = await factory.CreateClient()
            .PostAsJsonAsync("/api/auth/login", new { email = "admin@test.local" + OrSempreVero, password = OrSempreVero });

        Assert.True(response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.BadRequest, $"Status: {response.StatusCode}");
    }

    [Theory]
    [InlineData("a@b.com\r\nX-Injected: 1")]
    [InlineData("a@b.com\nINFO fake log line")]
    [InlineData("non-una-email")]
    public async Task Admin_EmailConNewlineOMalformataERifiutata(string email)
    {
        var client = await ConTokenAdminAsync();

        var response = await client.PostAsJsonAsync("/api/admin/utenti",
            new { email, password = ApiFactory.AdminPassword, ruoli = Array.Empty<string>() });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("../../etc/passwd")]
    [InlineData(OrSempreVero)]
    public async Task Admin_IdUtenteMalevoloDa404(string id)
    {
        var client = await ConTokenAdminAsync();

        var response = await client.DeleteAsync("/api/admin/utenti/" + Uri.EscapeDataString(id));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/Eventi/Revisione/Approva", "{}")]
    [InlineData("/api/Eventi/Revisione/Approva", "{\"ids\": null}")]
    [InlineData("/api/Eventi/Revisione/Rifiuta", "{}")]
    [InlineData("/api/Eventi/Revisione/Rifiuta", "{\"ids\": null, \"motivo\": null}")]
    [InlineData("/api/admin/utenti", "{}")]
    [InlineData("/api/admin/utenti", "{\"email\": null, \"password\": null, \"ruoli\": null}")]
    [InlineData("/api/admin/utenti", "{\"email\": \"a@b.com\", \"ruoli\": []}")]
    [InlineData("/api/admin/utenti", "{\"email\": \"a@b.com\", \"password\": \"Password!12345\"}")]
    public async Task BodyConCampiMancantiONulliDa400(string url, string corpo)
    {
        var client = await ConTokenAdminAsync();

        var response = await client.PostAsync(url, new StringContent(corpo, Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.DoesNotContain("   at ", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Admin_ModificaConBodyVuotoDa400()
    {
        var client = await ConTokenAdminAsync();

        var response = await client.PutAsync("/api/admin/utenti/qualunque", new StringContent("{}", Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Put_EventoConCampiTestoNulliDa400()
    {
        var corpo = "[{\"Id\": null, \"NomeEvento\": null, \"CittaEvento\": null, \"DescrizioneEvento\": null}]";

        var response = await factory.CreateClient().PutAsync("/api/Eventi/UpdateEventi", new StringContent(corpo, Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Revisione_IdConSqlInjectionNonModificaNulla()
    {
        var client = await ConTokenAdminAsync();
        await factory.CreateClient().PutAsJsonAsync("/api/Eventi/UpdateEventi", new[] { NuovoEvento("rev-sqli") });

        var response = await client.PostAsJsonAsync("/api/Eventi/Revisione/Approva", new { ids = new[] { OrSempreVero } });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(0, doc.RootElement.GetProperty("modificati").GetInt32());
    }
}
