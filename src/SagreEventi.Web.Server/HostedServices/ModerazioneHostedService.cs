using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using SagreEventi.Web.Server.Models.Identity;
using SagreEventi.Web.Server.Models.Services.Application;
using SagreEventi.Web.Server.Options;

namespace SagreEventi.Web.Server.HostedServices;

/// <summary>
/// Tells the moderators (Admin and Editor users) by e-mail when reports are waiting for review: one summary at every interval,
/// only if some report was not notified yet. The message carries the numbers and the link to the review page, never the text of
/// the reports (untrusted). A report is marked as notified only after at least one mail has been delivered, so a failure is
/// retried at the next cycle. One cycle at a time (the <see cref="PeriodicTimer"/> does not overlap), one replica, no distributed lock.
/// </summary>
public sealed class ModerazioneHostedService(
    IServiceScopeFactory serviceScopeFactory,
    IEmailSender emailSender,
    IOptionsMonitor<ModerazioneOptions> options,
    IOptionsMonitor<AppOptions> appOptions,
    TimeProvider timeProvider,
    ILogger<ModerazioneHostedService> logger) : BackgroundService
{
    /// <summary>Path of the review page in the web app.</summary>
    public const string PercorsoRevisione = "/gestione/revisione";

    /// <summary>Runs a cycle immediately and then at every configured interval until the host stops.</summary>
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(options.CurrentValue.Intervallo);
        // Hot read: if the interval changes in the configuration it applies immediately, without restarting the service
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

    /// <summary>Runs one cycle. Errors are logged and do not stop the service. Returns how many mails were delivered.</summary>
    public async Task<int> EseguiCicloAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var serviceScope = serviceScopeFactory.CreateScope();
            var eventiService = serviceScope.ServiceProvider.GetRequiredService<IEventiService>();

            var notifica = await eventiService.GetNotificaModerazioneAsync(cancellationToken);
            if (notifica.Nuove == 0)
            {
                return 0;
            }

            var destinatari = await LeggiDestinatariAsync(serviceScope.ServiceProvider, cancellationToken);
            if (destinatari.Count == 0)
            {
                logger.LogWarning("Avviso moderazione: {Nuove} nuove segnalazioni ma nessun moderatore con un indirizzo email", notifica.Nuove);
                return 0;
            }

            var messaggio = CostruisciMessaggio(notifica.Nuove, notifica.TotaleInAttesa, appOptions.CurrentValue.PublicBaseUrl);
            var consegnate = await InviaATuttiAsync(destinatari, messaggio, cancellationToken);
            if (consegnate == 0)
            {
                // Nothing delivered: the reports stay "not notified" and the next cycle tries again
                return 0;
            }

            // The mails already went out: if the update were cancelled the reports would be notified twice, so it is not tied to the stop request
            await eventiService.SegnaNotificateAsync(notifica.IdNuove, timeProvider.GetUtcNow().UtcDateTime, CancellationToken.None);
            logger.LogInformation("Avviso moderazione: {Nuove} nuove segnalazioni, {Consegnate} mail consegnate", notifica.Nuove, consegnate);
            return consegnate;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            return 0;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Avviso moderazione fallito");
            return 0;
        }
    }

    /// <summary>Subject and body of the notice: numbers and review link only, plain text.</summary>
    public static (string Oggetto, string Corpo) CostruisciMessaggio(int nuove, int totale, string baseUrl)
    {
        var link = baseUrl.TrimEnd('/') + PercorsoRevisione;
        var oggetto = nuove == 1 ? "Sagre & Eventi: 1 nuova segnalazione da moderare" : $"Sagre & Eventi: {nuove} nuove segnalazioni da moderare";
        var frase = nuove == 1 ? "C'è 1 nuova segnalazione da moderare" : $"Ci sono {nuove} nuove segnalazioni da moderare";
        var corpo = $"{frase} ({totale} in attesa in totale).\n\nApri la pagina di revisione: {link}\n";

        return (oggetto, corpo);
    }

    /// <summary>E-mail addresses of the Admin and Editor users, without duplicates and without empty values.</summary>
    private static async Task<List<string>> LeggiDestinatariAsync(IServiceProvider services, CancellationToken cancellationToken)
    {
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        var indirizzi = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var ruolo in Ruoli.Tutti)
        {
            cancellationToken.ThrowIfCancellationRequested();
            foreach (var utente in await userManager.GetUsersInRoleAsync(ruolo))
            {
                if (!string.IsNullOrWhiteSpace(utente.Email))
                {
                    indirizzi.Add(utente.Email.Trim());
                }
            }
        }

        return [.. indirizzi];
    }

    /// <summary>One mail per recipient; a recipient that fails does not stop the others. Returns how many were delivered.</summary>
    private async Task<int> InviaATuttiAsync(List<string> destinatari, (string Oggetto, string Corpo) messaggio, CancellationToken cancellationToken)
    {
        var consegnate = 0;
        var falliti = 0;

        foreach (var indirizzo in destinatari)
        {
            try
            {
                await emailSender.SendAsync(new EmailMessage(indirizzo, messaggio.Oggetto, messaggio.Corpo), cancellationToken);
                consegnate++;
            }
            catch (Exception ex) when (ex is EmailSendException or ArgumentException)
            {
                // Neither the address nor the content goes in the log
                falliti++;
                logger.LogWarning("Avviso moderazione: un destinatario non è stato raggiunto ({Tipo})", ex.GetType().Name);
            }
        }

        if (falliti > 0)
        {
            logger.LogWarning("Avviso moderazione: {Falliti} destinatari su {Totale} non raggiunti", falliti, destinatari.Count);
        }

        return consegnate;
    }
}
