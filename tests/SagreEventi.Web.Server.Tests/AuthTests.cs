using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using SagreEventi.Web.Server.Models.Identity;

namespace SagreEventi.Web.Server.Tests;

public class AuthTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory factory;

    public AuthTests(ApiFactory factory)
    {
        this.factory = factory;
    }

    private static async Task<string> LoginAsync(HttpClient client, string email, string password)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        response.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("accessToken").GetString()!;
    }

    [Fact]
    public async Task Login_ConCredenzialiDelSeedRestituisceUnToken()
    {
        var token = await LoginAsync(factory.CreateClient(), ApiFactory.AdminEmail, ApiFactory.AdminPassword);

        Assert.False(string.IsNullOrWhiteSpace(token));
    }

    [Fact]
    public async Task Login_ConPasswordErrataRispondeNonAutorizzato()
    {
        var response = await factory.CreateClient()
            .PostAsJsonAsync("/api/auth/login", new { email = ApiFactory.AdminEmail, password = "sbagliata" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Registrazione_PubblicaDisattiva()
    {
        var response = await factory.CreateClient()
            .PostAsJsonAsync("/api/auth/register", new { email = "nuovo@test.local", password = "Passw0rd!Test" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Seed_AssegnaIlRuoloAdminAlPrimoUtente()
    {
        using var scope = factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var admin = await userManager.FindByEmailAsync(ApiFactory.AdminEmail);

        Assert.NotNull(admin);
        Assert.True(await userManager.IsInRoleAsync(admin, Ruoli.Admin));
    }

    [Fact]
    public async Task Info_RichiedeIlToken()
    {
        var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/manage/info")).StatusCode);

        var token = await LoginAsync(client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/manage/info")).StatusCode);
    }

    [Fact]
    public async Task Me_RichiedeIlToken()
    {
        var response = await factory.CreateClient().GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Me_RestituisceEmailERuoliDellUtente()
    {
        var client = factory.CreateClient();
        var token = await LoginAsync(client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(ApiFactory.AdminEmail, doc.RootElement.GetProperty("email").GetString());
        Assert.Contains(doc.RootElement.GetProperty("ruoli").EnumerateArray(), r => r.GetString() == Ruoli.Admin);
    }

    [Fact]
    public async Task RateLimit_BloccaITentativiRipetuti()
    {
        using var isolata = new ApiFactory();
        var client = isolata.CreateClient();
        HttpStatusCode ultimo = default;

        for (var i = 0; i < 12; i++)
        {
            ultimo = (await client.PostAsJsonAsync("/api/auth/login", new { email = "x@test.local", password = "no" })).StatusCode;
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, ultimo);
    }
}
