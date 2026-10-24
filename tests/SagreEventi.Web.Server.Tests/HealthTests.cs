using System.Net;

namespace SagreEventi.Web.Server.Tests;

/// <summary>Liveness probe used by the Docker health check.</summary>
public class HealthTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Healthz_RispondeOkSenzaAutenticazioneENessunDettaglio()
    {
        var response = await factory.CreateClient().GetAsync("/healthz");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }
}
