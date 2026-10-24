using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using SagreEventi.Web.Server.HostedServices;
using SagreEventi.Web.Server.Models.Services.Infrastructure;

namespace SagreEventi.Web.Server.Tests;

/// <summary>
/// Avvia l'API reale sostituendo SQL Server con un database SQLite in memoria
/// (la connessione resta aperta per tutta la vita della factory).
/// </summary>
public class ApiFactory : WebApplicationFactory<Program>
{
    public const string AdminEmail = "admin@test.local";
    public const string AdminPassword = "Passw0rd!Test";

    private readonly SqliteConnection connection = new("DataSource=:memory:");

    public ApiFactory()
    {
        connection.Open();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureLogging(logging => logging.ClearProviders());

        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Identity:Admin:Email"] = AdminEmail,
            ["Identity:Admin:Password"] = AdminPassword,
            // The tests make many PUTs from the same address: the real limit is tested in a dedicated test
            ["Eventi:RichiestePutAlMinuto"] = "1000",
        }));

        builder.ConfigureServices(services =>
        {
            // AddDbContextPool registers the options, the configuration and the pool: all of them must be removed.
            var daRimuovere = services
                .Where(d => d.ServiceType == typeof(DbContextOptions<AppDbContext>)
                         || d.ServiceType == typeof(DbContextOptions)
                         || d.ServiceType == typeof(AppDbContext)
                         || (d.ServiceType.IsGenericType
                             && d.ServiceType.GetGenericArguments().Contains(typeof(AppDbContext))))
                .ToList();
            foreach (var descriptor in daRimuovere)
            {
                services.Remove(descriptor);
            }

            // The EventiHostedService timer would use the same SQLite connection in parallel with the tests (not thread-safe)
            foreach (var d in services.Where(d => d.ImplementationType == typeof(EventiHostedService)).ToList())
            {
                services.Remove(d);
            }

            services.AddDbContext<AppDbContext>(options => options.UseSqlite(connection));

            // The schema must exist before the Identity seed: this service starts first
            services.Insert(0, ServiceDescriptor.Singleton<IHostedService>(sp => new CreaSchemaHostedService(sp)));
        });
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        var host = base.CreateHost(builder);
        using var scope = host.Services.CreateScope();
        scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.EnsureCreated();
        return host;
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            connection.Dispose();
        }
    }
}

internal sealed class CreaSchemaHostedService(IServiceProvider services) : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = services.CreateScope();
        scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.EnsureCreated();
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
