using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;

namespace SagreEventi.Web.Server.Tests;

/// <summary>Tests of the restrictive CORS policy (only the origins in <c>Cors:Origins</c>).</summary>
public class CorsTests
{
    private static async Task<(HttpStatusCode Stato, bool HaHeaderCors)> RichiestaDaOrigineAsync(string?[] origini, string origine)
    {
        using var factory = new ApiFactory().WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, config) =>
            config.AddInMemoryCollection(origini.Select((o, i) => new KeyValuePair<string, string?>($"Cors:Origins:{i}", o)))));
        using var client = factory.CreateClient();
        using var richiesta = new HttpRequestMessage(HttpMethod.Get, "/api/Eventi/GetEventi");
        richiesta.Headers.Add("Origin", origine);

        var response = await client.SendAsync(richiesta);

        return (response.StatusCode, response.Headers.Contains("Access-Control-Allow-Origin"));
    }

    [Fact]
    public async Task Cors_UnaOrigineElencataERiconosciuta()
    {
        var (stato, haHeader) = await RichiestaDaOrigineAsync(["https://sagre.example.com"], "https://sagre.example.com");

        Assert.Equal(HttpStatusCode.OK, stato);
        Assert.True(haHeader);
    }

    [Fact]
    public async Task Cors_UnaOrigineNonElencataNonRiceveIlHeader()
    {
        var (_, haHeader) = await RichiestaDaOrigineAsync(["https://sagre.example.com"], "https://evil.example.com");

        Assert.False(haHeader);
    }

    [Fact]
    public async Task Cors_ConLOrigineVuotaDiDockerNessunaOrigineEAmmessa()
    {
        // Docker clears the sample origin with Cors__Origins__0="": it must not break the startup and must allow nothing
        var (stato, haHeader) = await RichiestaDaOrigineAsync([""], "http://localhost:4200");

        Assert.Equal(HttpStatusCode.OK, stato);
        Assert.False(haHeader);
    }
}
