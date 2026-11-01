using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SagreEventi.Shared.Models;
using SagreEventi.Web.Server.Endpoints;
using SagreEventi.Web.Server.Models.Services.Application;
using SagreEventi.Web.Server.Models.Services.Infrastructure;

namespace SagreEventi.Web.Server.Tests;

/// <summary>Integration tests of the anti-bot protection on <c>GetChallenge</c> and <c>UpdateEventi</c>, with real challenges solved by the test client.</summary>
public class AltchaApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string UpdateUrl = "/api/Eventi/UpdateEventi";
    private const string ChallengeUrl = "/api/Eventi/GetChallenge";

    private static EventoModel NuovoEvento(string id) => new()
    {
        Id = id,
        NomeEvento = "Sagra " + id,
        CittaEvento = "Verona",
        DataInizioEvento = new DateTime(2026, 7, 1),
        DataFineEvento = new DateTime(2026, 7, 3),
        DescrizioneEvento = "Descrizione",
        DataOraUltimaModifica = DateTime.UtcNow,
    };

    // The test pipeline does not add a proof when the request carries the skip header: the test decides what to send
    private static HttpRequestMessage Put(string id, string? proof)
    {
        var request = new HttpRequestMessage(HttpMethod.Put, UpdateUrl) { Content = JsonContent.Create(new[] { NuovoEvento(id) }) };
        request.Headers.Add(AltchaTestHelper.SkipHeader, "1");
        if (proof is not null)
        {
            request.Headers.TryAddWithoutValidation(EventiEndpoints.AltchaHeaderName, proof);
        }

        return request;
    }

    private static async Task<AltchaChallenge> GetChallengeAsync(HttpClient client)
        => (await client.GetFromJsonAsync<AltchaChallenge>(ChallengeUrl))!;

    private async Task<bool> ExistsInDbAsync(string id)
    {
        using var scope = factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<AppDbContext>().Eventi.FindAsync(id) is not null;
    }

    private static async Task AssertRejectedAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("altcha", body);
        // No internal detail: neither the reason nor anything about the key or the stack
        Assert.DoesNotContain("InvalidSolution", body);
        Assert.DoesNotContain("Exception", body);
        Assert.DoesNotContain(AltchaTestHelper.TestKey, body);
    }

    [Fact]
    public async Task GetChallenge_IsAnonymous_NotCached_AndIssuesDifferentChallenges()
    {
        var client = factory.CreateClient();

        var first = await client.GetAsync(ChallengeUrl);
        var second = await GetChallengeAsync(client);
        var firstBody = (await first.Content.ReadFromJsonAsync<AltchaChallenge>())!;

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Contains("no-store", first.Headers.CacheControl?.ToString());
        Assert.Equal("SHA-256", firstBody.Algorithm);
        Assert.Equal(1000, firstBody.MaxNumber);
        Assert.NotEqual(firstBody.Challenge, second.Challenge);
    }

    [Fact]
    public async Task GetChallenge_UsesTheWidgetFieldNames()
    {
        var json = await factory.CreateClient().GetStringAsync(ChallengeUrl);

        using var document = JsonDocument.Parse(json);
        var names = document.RootElement.EnumerateObject().Select(p => p.Name).Order().ToArray();
        Assert.Equal(["algorithm", "challenge", "maxnumber", "salt", "signature"], names);
    }

    [Fact]
    public async Task GetChallenge_IsRateLimitedPerIp()
    {
        using var limited = factory.WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, config) =>
            config.AddInMemoryCollection(new Dictionary<string, string?> { ["Eventi:RichiesteChallengeAlMinuto"] = "2" })));
        var client = limited.CreateClient();

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(ChallengeUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(ChallengeUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await client.GetAsync(ChallengeUrl)).StatusCode);
    }

    [Fact]
    public async Task UpdateEventi_WithoutProof_IsRejectedAndNothingIsStored()
    {
        var response = await factory.CreateClient().SendAsync(Put("altcha-senza-prova", null));

        await AssertRejectedAsync(response);
        Assert.False(await ExistsInDbAsync("altcha-senza-prova"));
    }

    [Fact]
    public async Task UpdateEventi_WithSolvedChallenge_InsertsTheEvent()
    {
        var client = factory.CreateClient();
        var proof = AltchaTestHelper.Solve(await GetChallengeAsync(client));

        var response = await client.SendAsync(Put("altcha-valida", proof));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(await ExistsInDbAsync("altcha-valida"));
    }

    [Fact]
    public async Task UpdateEventi_ReusingTheSameProof_IsRejected()
    {
        var client = factory.CreateClient();
        var proof = AltchaTestHelper.Solve(await GetChallengeAsync(client));

        Assert.Equal(HttpStatusCode.OK, (await client.SendAsync(Put("altcha-riuso-1", proof))).StatusCode);
        var replay = await client.SendAsync(Put("altcha-riuso-2", proof));

        await AssertRejectedAsync(replay);
        Assert.False(await ExistsInDbAsync("altcha-riuso-2"));
    }

    [Fact]
    public async Task UpdateEventi_WithWrongNumber_IsRejected()
    {
        var client = factory.CreateClient();
        var challenge = await GetChallengeAsync(client);
        var correct = JsonDocument.Parse(Convert.FromBase64String(AltchaTestHelper.Solve(challenge))).RootElement.GetProperty("number").GetInt64();

        await AssertRejectedAsync(await client.SendAsync(Put("altcha-numero", AltchaTestHelper.Encode(challenge, (correct + 1) % 1000))));
    }

    [Fact]
    public async Task UpdateEventi_WithChallengeNotIssuedByTheServer_IsRejected()
    {
        // A challenge from a server with another key is a forgery for this one
        using var other = new ApiFactory().WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, config) =>
            config.AddInMemoryCollection(new Dictionary<string, string?> { ["Altcha:HmacKey"] = "another-hmac-key-0123456789abcdef0123456789" })));
        var foreign = AltchaTestHelper.Solve(await GetChallengeAsync(other.CreateClient()));

        await AssertRejectedAsync(await factory.CreateClient().SendAsync(Put("altcha-estranea", foreign)));
    }

    [Theory]
    [InlineData("<script>alert(1)</script>")]
    [InlineData("' OR 1=1; DROP TABLE Eventi --")]
    [InlineData("../../../../etc/passwd")]
    [InlineData("e30=")]
    [InlineData("W10=")]
    [InlineData("bnVsbA==")]
    [InlineData("%00%0d%0aSet-Cookie:x=1")]
    public async Task UpdateEventi_WithHostileProof_IsRejectedWithoutServerError(string proof)
        => await AssertRejectedAsync(await factory.CreateClient().SendAsync(Put("altcha-ostile", proof)));

    [Fact]
    public async Task UpdateEventi_WithOversizedProof_IsRejectedWithoutServerError()
        => await AssertRejectedAsync(await factory.CreateClient().SendAsync(Put("altcha-enorme", new string('A', 20_000))));

    [Fact]
    public async Task UpdateEventi_WithProofOfMalformedJsonTypes_IsRejectedWithoutServerError()
    {
        var proof = Convert.ToBase64String(Encoding.UTF8.GetBytes("{\"algorithm\":1,\"challenge\":[],\"number\":{},\"salt\":null,\"signature\":true}"));

        await AssertRejectedAsync(await factory.CreateClient().SendAsync(Put("altcha-tipi", proof)));
    }

    [Fact]
    public async Task UpdateEventi_ProofIsCheckedBeforeTheContent()
    {
        // Even an invalid body gets the anti-bot rejection first: a bot learns nothing about the validation rules
        var request = new HttpRequestMessage(HttpMethod.Put, UpdateUrl) { Content = JsonContent.Create(new[] { new EventoModel { Id = "" } }) };
        request.Headers.Add(AltchaTestHelper.SkipHeader, "1");

        await AssertRejectedAsync(await factory.CreateClient().SendAsync(request));
    }
}
