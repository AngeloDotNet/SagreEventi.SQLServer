using System.Net;
using System.Text.Encodings.Web;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.HttpOverrides;
using System.Threading.RateLimiting;
using SagreEventi.Web.Server.Endpoints;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using SagreEventi.Web.Server.HostedServices;
using SagreEventi.Web.Server.Models.Services.Application;
using SagreEventi.Web.Server.Models.Services.Infrastructure;
using ScadenzaEventiOptions = SagreEventi.Web.Server.Options.ScadenzaEventiOptions;
using ZiggyCreatures.Caching.Fusion;

namespace SagreEventi.Web.Server.Extensions;

public static class ServiceCollectionExtensions
{
    /// <summary>Registers all the application services: JSON, CORS, cache, database, event services, rate limits, Identity and OpenAPI.</summary>
    public static IServiceCollection AddApplicationServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddHttpContextAccessor();
        services.AddProblemDetails();
        services.Configure<JsonOptions>(options =>
        {
            // The default encoder escapes <, >, & and quotes, so a stored script payload never appears as raw HTML in a response
            options.SerializerOptions.Encoder = JavaScriptEncoder.Default;
            options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
            options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
        });

        // Restrictive CORS: only the origins listed in Cors:Origins (bearer token, no cookies and no AllowCredentials)
        // Blank entries are ignored: in Docker the sample origin is cleared with Cors__Origins__0="" (same origin behind nginx)
        services.AddCors(options =>
        {
            options.AddDefaultPolicy(builder =>
            {
                var origini = (configuration.GetSection("Cors:Origins").Get<string[]>() ?? []).Where(o => !string.IsNullOrWhiteSpace(o)).ToArray();
                if (origini.Length > 0)
                {
                    builder.WithOrigins(origini);
                }
                builder.AllowAnyHeader();
                builder.AllowAnyMethod();
            });
        });

        // Configure FusionCache with the default options
        services.AddFusionCache()
            .WithDefaultEntryOptions(new FusionCacheEntryOptions
            {
                Duration = TimeSpan.FromMinutes(5),
                Priority = CacheItemPriority.Low,
            });

        services.AddDbContextPool<AppDbContext>(optionsBuilder =>
        {
            var connectionString = configuration.GetSection("ConnectionStrings").GetValue<string>("Default");
            optionsBuilder.UseSqlServer(connectionString, options =>
            {
                // Info su: https://docs.microsoft.com/en-us/ef/core/miscellaneous/connection-resiliency
                options.EnableRetryOnFailure(3);                            // Enable connection resiliency
                options.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName);
                options.MigrationsHistoryTable("Migrations", "dbo");
            });
        });

        services.Configure<ScadenzaEventiOptions>(configuration.GetSection("Eventi"));
        services.AddHostedService<EventiHostedService>();
        services.AddTransient<IEventiService, EfCoreEventiService>();

        // Rate limit on writes (anonymous insert): requests per minute per IP, read from the configuration for each new partition
        services.AddRateLimiter(options => options.AddPolicy(EventiEndpoints.ScritturaRateLimitPolicy, httpContext =>
        {
            var limite = httpContext.RequestServices.GetRequiredService<IConfiguration>()
                .GetValue("Eventi:RichiestePutAlMinuto", EventiEndpoints.RichiestePutAlMinutoDefault);
            return RateLimitPartition.GetFixedWindowLimiter(
                httpContext.Connection.RemoteIpAddress?.ToString() ?? "sconosciuto",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = limite, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 });
        }));

        // Rate limit on GetStati (anonymous, by id): requests per minute per IP
        services.AddRateLimiter(options => options.AddPolicy(EventiEndpoints.StatiRateLimitPolicy, httpContext =>
        {
            var limite = httpContext.RequestServices.GetRequiredService<IConfiguration>()
                .GetValue("Eventi:RichiesteStatiAlMinuto", EventiEndpoints.RichiesteStatiAlMinutoDefault);
            return RateLimitPartition.GetFixedWindowLimiter(
                httpContext.Connection.RemoteIpAddress?.ToString() ?? "sconosciuto",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = limite, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 });
        }));

        services.AddHealthChecks();
        ConfiguraForwardedHeaders(services, configuration);
        services.AddIdentityServices();
        services.AddOpenApiServices();
        services.Configure<KestrelServerOptions>(configuration.GetSection("Kestrel"));

        return services;
    }

    /// <summary>
    /// Behind a reverse proxy (nginx) the client IP and the scheme arrive in X-Forwarded-For / X-Forwarded-Proto.
    /// They are honoured only when sent by a trusted proxy, listed in <c>ForwardedHeaders:KnownProxies</c> (IPs) or
    /// <c>ForwardedHeaders:KnownNetworks</c> (CIDR, e.g. the Docker network); otherwise only loopback is trusted and the headers are ignored.
    /// </summary>
    private static void ConfiguraForwardedHeaders(IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            options.ForwardLimit = 1;

            foreach (var proxy in configuration.GetSection("ForwardedHeaders:KnownProxies").Get<string[]>() ?? [])
            {
                options.KnownProxies.Add(IPAddress.Parse(proxy));
            }

            foreach (var rete in configuration.GetSection("ForwardedHeaders:KnownNetworks").Get<string[]>() ?? [])
            {
                options.KnownIPNetworks.Add(System.Net.IPNetwork.Parse(rete));
            }
        });
    }
}
