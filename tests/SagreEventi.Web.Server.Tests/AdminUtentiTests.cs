using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using SagreEventi.Web.Server.Extensions;
using SagreEventi.Web.Server.Models.Identity;

namespace SagreEventi.Web.Server.Tests;

/// <summary>Gestione utenti e ruoli: 401 per l'anonimo, 403 per l'Editor, funzionante e protetta per l'Admin.</summary>
public class AdminUtentiTests : IClassFixture<ApiFactory>
{
    private const string Password = "Passw0rd!Test";
    private const string EditorEmail = "editor-admin-tests@test.local";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly ApiFactory factory;
    private static readonly Dictionary<(ApiFactory, string), string> Token = [];
    private static readonly SemaphoreSlim LoginLock = new(1, 1);

    public AdminUtentiTests(ApiFactory factory)
    {
        this.factory = factory;
    }

    private sealed record Utente(string Id, string Email, string[] Ruoli);

    private static async Task<string> LoginAsync(HttpClient client, string email, string password)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        response.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("accessToken").GetString() ?? throw new InvalidOperationException("accessToken mancante");
    }

    // Login is limited to 10 per minute per IP and xUnit creates one instance per test: each user's token is obtained once per factory
    private async Task<HttpClient> ConTokenAsync(string email)
    {
        var client = factory.CreateClient();
        await LoginLock.WaitAsync();
        try
        {
            if (!Token.TryGetValue((factory, email), out var token))
            {
                token = await LoginAsync(client, email, email == ApiFactory.AdminEmail ? ApiFactory.AdminPassword : Password);
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

    private Task<HttpClient> ComeAdminAsync() => ConTokenAsync(ApiFactory.AdminEmail);

    private async Task<HttpClient> ComeEditorAsync()
    {
        using (var scope = factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            if (await userManager.FindByEmailAsync(EditorEmail) is null)
            {
                var utente = new ApplicationUser { UserName = EditorEmail, Email = EditorEmail, EmailConfirmed = true };
                Assert.True((await userManager.CreateAsync(utente, Password)).Succeeded);
                Assert.True((await userManager.AddToRoleAsync(utente, Ruoli.Editor)).Succeeded);
            }
        }

        return await ConTokenAsync(EditorEmail);
    }

    private static async Task<Utente> CreaAsync(HttpClient client, string email, params string[] ruoli)
    {
        var response = await client.PostAsJsonAsync("/api/admin/utenti", new { email, password = Password, ruoli });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<Utente>(Json) ?? throw new InvalidOperationException("Risposta vuota");
    }

    private static async Task<List<Utente>> ElencoAsync(HttpClient client)
        => await client.GetFromJsonAsync<List<Utente>>("/api/admin/utenti", Json) ?? throw new InvalidOperationException("Risposta vuota");

    [Theory]
    [InlineData("GET", "/api/admin/utenti")]
    [InlineData("GET", "/api/admin/ruoli")]
    [InlineData("POST", "/api/admin/utenti")]
    [InlineData("PUT", "/api/admin/utenti/x")]
    [InlineData("DELETE", "/api/admin/utenti/x")]
    public async Task Anonimo_NonAutorizzato(string metodo, string url)
    {
        var response = await factory.CreateClient().SendAsync(new HttpRequestMessage(new HttpMethod(metodo), url));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("GET", "/api/admin/utenti")]
    [InlineData("GET", "/api/admin/ruoli")]
    [InlineData("POST", "/api/admin/utenti")]
    [InlineData("PUT", "/api/admin/utenti/x")]
    [InlineData("DELETE", "/api/admin/utenti/x")]
    public async Task Editor_Vietato(string metodo, string url)
    {
        var response = await (await ComeEditorAsync()).SendAsync(new HttpRequestMessage(new HttpMethod(metodo), url));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Admin_VedeRuoliEUtenti()
    {
        var client = await ComeAdminAsync();

        var ruoli = await client.GetFromJsonAsync<string[]>("/api/admin/ruoli") ?? throw new InvalidOperationException("Risposta vuota");
        var utenti = await ElencoAsync(client);

        Assert.Equal([Ruoli.Admin, Ruoli.Editor], ruoli);
        var seed = Assert.Single(utenti, u => u.Email == ApiFactory.AdminEmail);
        Assert.Contains(Ruoli.Admin, seed.Ruoli);
    }

    [Fact]
    public async Task Admin_CreaUtenteConRuoli()
    {
        var client = await ComeAdminAsync();

        var creato = await CreaAsync(client, "nuovo1@test.local", Ruoli.Editor);

        Assert.Equal(["Editor"], creato.Ruoli);
        Assert.Contains(await ElencoAsync(client), u => u.Id == creato.Id && u.Email == "nuovo1@test.local");
    }

    [Theory]
    [InlineData("non-una-email", Password, "Editor")]
    [InlineData("valida@test.local", "", "Editor")]
    [InlineData("valida@test.local", "debole", "Editor")]
    [InlineData("valida@test.local", Password, "Superuser")]
    public async Task Admin_CreazioneConDatiNonValidiDa400(string email, string password, string ruolo)
    {
        var response = await (await ComeAdminAsync()).PostAsJsonAsync("/api/admin/utenti", new { email, password, ruoli = new[] { ruolo } });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    /// <summary>Passwords shorter than the minimum length are rejected on creation and on change.</summary>
    [Fact]
    public async Task Admin_RifiutaPasswordTroppoCorta()
    {
        var client = await ComeAdminAsync();
        var corta = "Ab1!" + new string('x', IdentityServices.MinPasswordLength - 5);

        var creazione = await client.PostAsJsonAsync("/api/admin/utenti", new { email = "corta@test.local", password = corta, ruoli = Array.Empty<string>() });
        Assert.Equal(HttpStatusCode.BadRequest, creazione.StatusCode);

        var valida = corta + "x";
        var creato = await client.PostAsJsonAsync("/api/admin/utenti", new { email = "corta@test.local", password = valida, ruoli = Array.Empty<string>() });
        Assert.Equal(HttpStatusCode.Created, creato.StatusCode);
    }

    [Fact]
    public async Task Admin_NonCreaDueUtentiConLaStessaEmail()
    {
        var client = await ComeAdminAsync();
        await CreaAsync(client, "doppio@test.local");

        var response = await client.PostAsJsonAsync("/api/admin/utenti", new { email = "doppio@test.local", password = Password, ruoli = Array.Empty<string>() });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Admin_ModificaEmailRuoliEPassword()
    {
        var client = await ComeAdminAsync();
        var utente = await CreaAsync(client, "da-modificare@test.local", Ruoli.Editor);

        var response = await client.PutAsJsonAsync($"/api/admin/utenti/{utente.Id}",
            new { email = "modificato@test.local", password = "NuovaPassw0rd!", ruoli = new[] { Ruoli.Admin } });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var letto = Assert.Single(await ElencoAsync(client), u => u.Id == utente.Id);
        Assert.Equal("modificato@test.local", letto.Email);
        Assert.Equal(["Admin"], letto.Ruoli);
        // The new email is also the user name and the new password works
        Assert.False(string.IsNullOrEmpty(await LoginAsync(factory.CreateClient(), "modificato@test.local", "NuovaPassw0rd!")));
    }

    [Fact]
    public async Task Admin_ModificaSenzaPasswordLaLasciaInvariata()
    {
        var client = await ComeAdminAsync();
        var utente = await CreaAsync(client, "stessa-password@test.local");

        var response = await client.PutAsJsonAsync($"/api/admin/utenti/{utente.Id}",
            new { email = "stessa-password@test.local", password = "", ruoli = new[] { Ruoli.Editor } });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(string.IsNullOrEmpty(await LoginAsync(factory.CreateClient(), "stessa-password@test.local", Password)));
    }

    [Fact]
    public async Task Admin_ModificaUtenteInesistenteDa404()
    {
        var response = await (await ComeAdminAsync()).PutAsJsonAsync("/api/admin/utenti/non-esiste",
            new { email = "x@test.local", ruoli = Array.Empty<string>() });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Admin_NonPuoCancellareSeStesso()
    {
        var client = await ComeAdminAsync();
        var io = (await ElencoAsync(client)).Single(u => u.Email == ApiFactory.AdminEmail);

        var response = await client.DeleteAsync($"/api/admin/utenti/{io.Id}");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains(await ElencoAsync(client), u => u.Id == io.Id);
    }

    [Fact]
    public async Task Admin_NonPuoTogliersiIlRuoloAdmin()
    {
        var client = await ComeAdminAsync();
        var io = (await ElencoAsync(client)).Single(u => u.Email == ApiFactory.AdminEmail);

        var response = await client.PutAsJsonAsync($"/api/admin/utenti/{io.Id}", new { email = io.Email, ruoli = new[] { Ruoli.Editor } });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains(Ruoli.Admin, (await ElencoAsync(client)).Single(u => u.Id == io.Id).Ruoli);
    }

    [Fact]
    public async Task Admin_CancellaUnAltroUtenteEAltroAdmin()
    {
        var client = await ComeAdminAsync();
        var semplice = await CreaAsync(client, "da-cancellare@test.local", Ruoli.Editor);
        var secondoAdmin = await CreaAsync(client, "secondo-admin@test.local", Ruoli.Admin);

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/admin/utenti/{semplice.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/admin/utenti/{secondoAdmin.Id}")).StatusCode);

        var elenco = await ElencoAsync(client);
        Assert.DoesNotContain(elenco, u => u.Id == semplice.Id || u.Id == secondoAdmin.Id);
        Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync($"/api/admin/utenti/{semplice.Id}")).StatusCode);
    }

    [Fact]
    public async Task Admin_PuoRevocareIlRuoloAdminAdUnAltro()
    {
        var client = await ComeAdminAsync();
        var altro = await CreaAsync(client, "retrocesso@test.local", Ruoli.Admin);

        var response = await client.PutAsJsonAsync($"/api/admin/utenti/{altro.Id}", new { email = altro.Email, ruoli = Array.Empty<string>() });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty((await ElencoAsync(client)).Single(u => u.Id == altro.Id).Ruoli);
    }
}
