using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SagreEventi.Shared.Models;

namespace SagreEventi.Web.Server.Tests;

/// <summary>Tests of the reverse proxy support: X-Forwarded-For is honoured only when sent by a trusted proxy.</summary>
public class ForwardedHeadersTests
{
    private static readonly IPAddress IndirizzoProxy = IPAddress.Parse("10.0.0.5");

    /// <summary>Simulates a connection coming from the proxy, which the test server does not set.</summary>
    private sealed class IndirizzoRemotoFinto : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use((contesto, avanti) =>
            {
                contesto.Connection.RemoteIpAddress = IndirizzoProxy;
                return avanti();
            });
            next(app);
        };
    }

    private static HttpClient ClientDietroProxy(ApiFactory radice, string? reteFidata)
    {
        var factory = radice.WithWebHostBuilder(builder =>
        {
            var valori = new Dictionary<string, string?> { ["Eventi:RichiestePutAlMinuto"] = "1" };
            if (reteFidata is not null)
            {
                valori["ForwardedHeaders:KnownNetworks:0"] = reteFidata;
            }

            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(valori));
            builder.ConfigureServices(services => services.AddSingleton<IStartupFilter, IndirizzoRemotoFinto>());
        });
        return factory.CreateClient();
    }


    private static Task<HttpResponseMessage> PutDa(HttpClient client, string ipClient, string id)
    {
        var richiesta = new HttpRequestMessage(HttpMethod.Put, "/api/Eventi/UpdateEventi")
        {
            Content = JsonContent.Create(new[]
            {
                new EventoModel
                {
                    Id = id, NomeEvento = "Sagra " + id, CittaEvento = "Verona", DescrizioneEvento = "Descrizione",
                    DataInizioEvento = new DateTime(2026, 7, 1), DataFineEvento = new DateTime(2026, 7, 3),
                },
            }),
        };
        richiesta.Headers.Add("X-Forwarded-For", ipClient);
        return client.SendAsync(richiesta);
    }

    [Fact]
    public async Task ProxyFidato_IlRateLimitVaPerClientReale()
    {
        using var radice = new ApiFactory();
        using var client = ClientDietroProxy(radice, "10.0.0.0/8");

        // Two different clients behind the same proxy have separate limits (1 per minute each)...
        Assert.Equal(HttpStatusCode.OK, (await PutDa(client, "203.0.113.1", "fwd-a1")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await PutDa(client, "203.0.113.2", "fwd-b1")).StatusCode);
        // ...and the same client over the limit gets blocked.
        Assert.Equal(HttpStatusCode.TooManyRequests, (await PutDa(client, "203.0.113.1", "fwd-a2")).StatusCode);
    }

    [Fact]
    public async Task ProxyNonFidato_IlHeaderXForwardedForEIgnorato()
    {
        using var radice = new ApiFactory();
        using var client = ClientDietroProxy(radice, null);

        // The header is ignored, so a spoofed IP cannot dodge the limit: everything counts as the proxy's address.
        Assert.Equal(HttpStatusCode.OK, (await PutDa(client, "203.0.113.1", "spoof-1")).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await PutDa(client, "203.0.113.2", "spoof-2")).StatusCode);
    }
}
