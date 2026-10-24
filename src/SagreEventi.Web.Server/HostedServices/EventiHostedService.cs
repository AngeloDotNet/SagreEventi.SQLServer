using Microsoft.Extensions.Options;
using SagreEventi.Web.Server.Models.Services.Application;
using SagreEventi.Web.Server.Options;

namespace SagreEventi.Web.Server.HostedServices;

/// <summary>
/// Concludes events whose end date has passed: only the server decides the conclusion.
/// One cycle at a time (the <see cref="PeriodicTimer"/> does not overlap); the interval follows the configuration, also at runtime.
/// </summary>
public class EventiHostedService(
    IServiceScopeFactory serviceScopeFactory,
    IOptionsMonitor<ScadenzaEventiOptions> options,
    ILogger<EventiHostedService> logger) : BackgroundService
{
    /// <summary>Runs an expiry cycle immediately and then at every configured interval until the host stops.</summary>
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(options.CurrentValue.Intervallo);
        // Hot read: if the interval changes in appsettings it applies immediately, without restarting the service
        using var ascolto = options.OnChange(o => timer.Period = o.Intervallo);

        do
        {
            await EseguiCicloAsync(stoppingToken);
        }
        while (await AttendiProssimoCicloAsync(timer, stoppingToken));
    }

    private static async Task<bool> AttendiProssimoCicloAsync(PeriodicTimer timer, CancellationToken stoppingToken)
    {
        try
        {
            return await timer.WaitForNextTickAsync(stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return false;
        }
    }

    /// <summary>Runs one expiry cycle. Errors are logged and do not stop the service. Returns how many events were concluded.</summary>
    public async Task<int> EseguiCicloAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var serviceScope = serviceScopeFactory.CreateScope();
            var eventiService = serviceScope.ServiceProvider.GetRequiredService<IEventiService>();

            var conclusi = await eventiService.ConcludiScadutiAsync(DateTime.UtcNow, cancellationToken);
            if (conclusi > 0)
            {
                logger.LogInformation("Scadenza eventi: {Conclusi} eventi conclusi", conclusi);
            }

            return conclusi;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            return 0;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Esecuzione fallita");
            return 0;
        }
    }
}
