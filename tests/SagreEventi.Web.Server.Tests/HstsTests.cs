using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.HttpsPolicy;
using Microsoft.Extensions.DependencyInjection;

namespace SagreEventi.Web.Server.Tests;

/// <summary>Security tests of the HSTS header (Strict-Transport-Security).</summary>
public class HstsTests
{
    private static async Task<IEnumerable<string>?> HeaderHstsAsync(string ambiente)
    {
        using var factory = new ApiFactory().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment(ambiente);
            // By default HSTS skips localhost: clear the exclusions so the test host is covered
            builder.ConfigureServices(services => services.Configure<HstsOptions>(options => options.ExcludedHosts.Clear()));
        });
        using var client = factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

        var response = await client.GetAsync("/api/Eventi/GetEventi");

        return response.Headers.TryGetValues("Strict-Transport-Security", out var valori) ? valori : null;
    }

    [Fact]
    public async Task Hsts_FuoriDaDevelopmentIlHeaderEPresente()
    {
        var valori = await HeaderHstsAsync("Production");

        Assert.NotNull(valori);
        Assert.Contains(valori, v => v.Contains("max-age="));
    }

    [Fact]
    public async Task Hsts_InDevelopmentIlHeaderNonCe()
    {
        Assert.Null(await HeaderHstsAsync("Development"));
    }
}
