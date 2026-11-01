using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SagreEventi.Shared.Models;
using SagreEventi.Web.Server.Models.Identity;
using SagreEventi.Web.Server.Models.Services.Application;
using SagreEventi.Web.Server.Validation;

namespace SagreEventi.Web.Server.Endpoints;

/// <summary>Public endpoints to read and report events (<c>/api/Eventi</c>).</summary>
public static class EventiEndpoints
{
    /// <summary>Maps the event endpoints: public reads, anonymous inserts and role-restricted updates.</summary>
    public static IEndpointRouteBuilder MapEventiEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/Eventi").WithTags("Eventi");

        group.MapGet("/GetEventi", GetEventiAsync);
        group.MapGet("/GetStati", GetStatiAsync).RequireRateLimiting(StatiRateLimitPolicy);
        group.MapGet("/GetChallenge", GetChallenge).RequireRateLimiting(ChallengeRateLimitPolicy)
            .Produces<AltchaChallenge>();
        group.MapPut("/UpdateEventi", UpdateEventiAsync).RequireRateLimiting(ScritturaRateLimitPolicy);

        return app;
    }

    public const string ScritturaRateLimitPolicy = "scrittura";
    public const string StatiRateLimitPolicy = "stati";
    /// <summary>Rate limit policy name for the anti-bot challenge requests.</summary>
    public const string ChallengeRateLimitPolicy = "challenge";

    /// <summary>Request header carrying the solved anti-bot challenge (base64 JSON produced by the ALTCHA widget).</summary>
    public const string AltchaHeaderName = "X-Altcha";

    /// <summary>Default challenge requests allowed per minute.</summary>
    public const int RichiesteChallengeAlMinutoDefault = 30;
    public const int MaxIdStatiPerRichiesta = 50;
    public const int RichiesteStatiAlMinutoDefault = 30;
    public const int MaxEventiPerRichiestaDefault = 20;
    public const int RichiestePutAlMinutoDefault = 10;

    private static async Task<List<EventoModel>> GetEventiAsync(
        IEventiService eventiService, ILogger<EventiLog> logger, CancellationToken cancellationToken, DateTime? since = null)
    {
        var da = since.GetValueOrDefault();
        logger.LogInformation("GetEventiAsync called with since: {Since}", da);
        return await eventiService.GetEventiAsync(da, cancellationToken);
    }

    /// <summary>Anonymous: whoever reported an event (client-generated id, a UUID) can learn its outcome. Returns the state only, and a rejection is not revealed (it appears as pending).</summary>
    private static async Task<IResult> GetStatiAsync(
        IEventiService eventiService, CancellationToken cancellationToken, string[]? ids = null)
    {
        var richiesti = (ids ?? []).Where(id => !string.IsNullOrWhiteSpace(id)).Distinct().ToList();
        if (richiesti.Count == 0 || richiesti.Count > MaxIdStatiPerRichiesta || richiesti.Any(id => id.Length > EventoModel.MaxIdLength))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["ids"] = [$"Indicare da 1 a {MaxIdStatiPerRichiesta} id, lunghi al massimo {EventoModel.MaxIdLength} caratteri."],
            });
        }

        return Results.Ok(await eventiService.GetStatiAsync(richiesti, cancellationToken));
    }

    /// <summary>Anonymous: issues a signed proof-of-work challenge that the client must solve and send in the <c>X-Altcha</c> header of <c>UpdateEventi</c>. Never cached.</summary>
    private static IResult GetChallenge(IAltchaService altchaService, HttpContext httpContext)
    {
        httpContext.Response.Headers.CacheControl = "no-store";
        return Results.Ok(altchaService.CreateChallenge());
    }

    private static async Task<IResult> UpdateEventiAsync(
        List<EventoModel> eventi, ClaimsPrincipal utente, IAuthorizationService authorization, IConfiguration configuration,
        IEventiService eventiService, IAltchaService altchaService, ILogger<EventiLog> logger, CancellationToken cancellationToken,
        [FromHeader(Name = AltchaHeaderName)] string? altcha = null)
    {
        logger.LogInformation("UpdateEventiAsync called with {Count} eventi", eventi.Count);

        // Anti-bot: a valid, unused proof of work is required from every caller, authenticated or not (the reason is logged, never returned)
        var prova = altchaService.Verify(altcha);
        if (prova != AltchaVerificationResult.Valid)
        {
            logger.LogWarning("UpdateEventiAsync rejected: anti-bot verification {Result}", prova);
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["altcha"] = ["Verifica anti-bot mancante, non valida o scaduta."],
            });
        }

        // Per-request limit: the insert is anonymous, without a cap a single call could insert thousands of rows
        var massimo = configuration.GetValue("Eventi:MaxPerRichiesta", MaxEventiPerRichiestaDefault);
        if (eventi.Count > massimo)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["eventi"] = [$"Si possono inviare al massimo {massimo} eventi per richiesta."],
            });
        }

        var errori = EventoValidator.Validate(eventi);
        if (errori.Count > 0)
        {
            return Results.ValidationProblem(errori);
        }

        // Insert of new events: anonymous. Edit of existing events: only with the PuoModificare policy;
        // for the others, editing an already existing event gives 403 (the new events in the request are inserted anyway; re-sending exactly what is stored remains a 200).
        var consentiModifiche = (await authorization.AuthorizeAsync(utente, Policies.PuoModificare)).Succeeded;
        var consentito = await eventiService.UpdateEventiAsync(eventi, consentiModifiche, cancellationToken);

        return consentito
            ? Results.Ok()
            : Results.Problem(statusCode: StatusCodes.Status403Forbidden, title: "Non puoi modificare eventi già esistenti.");
    }

    /// <summary>Log category of the Eventi endpoints.</summary>
    public sealed class EventiLog;
}
