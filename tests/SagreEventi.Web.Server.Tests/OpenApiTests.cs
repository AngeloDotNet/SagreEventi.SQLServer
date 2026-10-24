using Microsoft.AspNetCore.Hosting;
using System.Text.Json;

namespace SagreEventi.Web.Server.Tests;

public class OpenApiTests
{
    [Fact]
    public async Task Documento_EsponeGliEndpointELoSchemaBearer()
    {
        using var factory = new ApiFactory().WithWebHostBuilder(b => b.UseEnvironment("Development"));
        var client = factory.CreateClient();

        var json = await client.GetStringAsync("/openapi/v1.json");
        using var doc = JsonDocument.Parse(json);

        var paths = doc.RootElement.GetProperty("paths");
        Assert.True(paths.TryGetProperty("/api/Eventi/GetEventi", out _));
        Assert.True(paths.TryGetProperty("/api/Eventi/UpdateEventi", out _));
        var bearer = doc.RootElement.GetProperty("components").GetProperty("securitySchemes").GetProperty("Bearer");
        Assert.Equal("bearer", bearer.GetProperty("scheme").GetString());
    }
}
