using System.Security.Claims;
using SagreEventi.Shared.Models;
using SagreEventi.Web.Server.Models.Identity;
using SagreEventi.Web.Server.Models.Services.Application;

namespace SagreEventi.Web.Server.Endpoints;

/// <summary>Review of reported events: reserved to those with the <c>PuoModificare</c> policy (Admin and Editor).</summary>
public static class RevisioneEndpoints
{
    public const int MaxIdPerRichiesta = 100;
    public const int MaxEventiDaRivedere = 200;
    public const int MaxMotivoLength = 500;

    /// <summary>Maps the review endpoints (list to review, concluded events for the Admin, approve, reject) under <c>/api/Eventi/Revisione</c>.</summary>
    public static IEndpointRouteBuilder MapRevisioneEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/Eventi/Revisione").WithTags("Revisione").RequireAuthorization(Policies.PuoModificare);

        group.MapGet("/DaRivedere", DaRivedereAsync);
        // Concluded events are read-only history: only the Admin can look at them (on top of the group policy)
        group.MapGet("/Conclusi", ConclusiAsync).RequireAuthorization(Policies.SoloAdmin);
        group.MapPost("/Approva", ApprovaAsync);
        group.MapPost("/Rifiuta", RifiutaAsync);

        return app;
    }

    private static async Task<IResult> DaRivedereAsync(
        IEventiService eventiService, CancellationToken cancellationToken, StatoModerazione stato = StatoModerazione.InAttesa)
    {
        if (stato == StatoModerazione.Approvato)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["stato"] = ["Sono ammessi solo i valori InAttesa e Rifiutato."],
            });
        }

        return Results.Ok(await eventiService.GetDaRivedereAsync(stato, MaxEventiDaRivedere, cancellationToken));
    }

    private static async Task<IResult> ConclusiAsync(IEventiService eventiService, CancellationToken cancellationToken)
        => Results.Ok(await eventiService.GetConclusiAsync(MaxEventiDaRivedere, cancellationToken));

    private static async Task<IResult> ApprovaAsync(
        ApprovaEventiRequest richiesta, ClaimsPrincipal utente, IEventiService eventiService,
        ILogger<RevisioneLog> logger, CancellationToken cancellationToken)
    {
        var errori = ValidaIds(richiesta.Ids);
        if (errori.Count > 0)
        {
            return Results.ValidationProblem(errori);
        }

        var revisore = Revisore(utente);
        var modificati = await eventiService.ApprovaAsync(richiesta.Ids.Distinct().ToList(), revisore, cancellationToken);
        logger.LogInformation("{Revisore} ha approvato {Modificati} eventi su {Richiesti}", revisore, modificati, richiesta.Ids.Count);

        return Results.Ok(new RevisioneEsito { Modificati = modificati });
    }

    private static async Task<IResult> RifiutaAsync(
        RifiutaEventiRequest richiesta, ClaimsPrincipal utente, IEventiService eventiService,
        ILogger<RevisioneLog> logger, CancellationToken cancellationToken)
    {
        var errori = ValidaIds(richiesta.Ids);
        // The note is optional: the reporter never sees it, it is kept only as history for the staff
        var motivo = richiesta.Motivo?.Trim();
        if (motivo is { Length: > MaxMotivoLength })
        {
            errori["motivo"] = [$"Il motivo può essere lungo al massimo {MaxMotivoLength} caratteri."];
        }

        if (errori.Count > 0)
        {
            return Results.ValidationProblem(errori);
        }

        var revisore = Revisore(utente);
        var modificati = await eventiService.RifiutaAsync(richiesta.Ids.Distinct().ToList(), motivo, revisore, cancellationToken);
        logger.LogInformation("{Revisore} ha rifiutato {Modificati} eventi su {Richiesti}", revisore, modificati, richiesta.Ids.Count);

        return Results.Ok(new RevisioneEsito { Modificati = modificati });
    }

    private static Dictionary<string, string[]> ValidaIds(List<string>? ids)
    {
        var errori = new Dictionary<string, string[]>();
        if (ids is null || ids.Count == 0)
        {
            errori["ids"] = ["Indicare almeno un evento."];
        }
        else if (ids.Count > MaxIdPerRichiesta)
        {
            errori["ids"] = [$"Si possono indicare al massimo {MaxIdPerRichiesta} eventi per richiesta."];
        }
        else if (ids.Any(string.IsNullOrWhiteSpace))
        {
            errori["ids"] = ["Gli id degli eventi non possono essere vuoti."];
        }

        return errori;
    }

    private static string Revisore(ClaimsPrincipal utente)
        => utente.FindFirstValue(ClaimTypes.Email) ?? utente.Identity?.Name ?? "sconosciuto";

    /// <summary>Log category of the review endpoints.</summary>
    public sealed class RevisioneLog;
}
