using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SagreEventi.Web.Server.Models.Identity;

namespace SagreEventi.Web.Server.Endpoints;

/// <summary>
/// User and role management, reserved to <c>Admin</c> only (policy <c>SoloAdmin</c>).
/// Roles cannot be edited: only those in <see cref="Ruoli.Tutti"/> exist and they can only be assigned to or revoked from users.
/// </summary>
public static class AdminUtentiEndpoints
{
    public const int MaxEmailLength = 256;

    /// <summary>Maps the user and role management endpoints under <c>/api/admin</c> (Admin only).</summary>
    public static IEndpointRouteBuilder MapAdminUtentiEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/admin").WithTags("Amministrazione").RequireAuthorization(Policies.SoloAdmin);

        group.MapGet("/ruoli", () => Results.Ok(Ruoli.Tutti));
        group.MapGet("/utenti", ElencoAsync);
        group.MapPost("/utenti", CreaAsync);
        group.MapPut("/utenti/{id}", ModificaAsync);
        group.MapDelete("/utenti/{id}", EliminaAsync);

        return app;
    }

    private static async Task<IResult> ElencoAsync(UserManager<ApplicationUser> userManager)
    {
        var utenti = await userManager.Users.AsNoTracking().OrderBy(u => u.Email).ToListAsync();
        var risultato = new List<UtenteAdminModel>(utenti.Count);
        foreach (var utente in utenti)
        {
            risultato.Add(ToModel(utente, await userManager.GetRolesAsync(utente)));
        }

        return Results.Ok(risultato);
    }

    private static async Task<IResult> CreaAsync(
        CreaUtenteRequest richiesta, UserManager<ApplicationUser> userManager, ILogger<AdminLog> logger)
    {
        var errori = Valida(richiesta.Email, richiesta.Ruoli, passwordObbligatoria: true, richiesta.Password);
        if (errori.Count > 0)
        {
            return Results.ValidationProblem(errori);
        }

        var email = richiesta.Email!.Trim();
        var utente = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true };
        var creato = await userManager.CreateAsync(utente, richiesta.Password!);
        if (!creato.Succeeded)
        {
            return Results.ValidationProblem(ErroriIdentity(creato));
        }

        var ruoli = richiesta.Ruoli!.Distinct().ToList();
        if (ruoli.Count > 0)
        {
            var assegnati = await userManager.AddToRolesAsync(utente, ruoli);
            if (!assegnati.Succeeded)
            {
                await userManager.DeleteAsync(utente);
                return Results.ValidationProblem(ErroriIdentity(assegnati));
            }
        }

        logger.LogInformation("Creato l'utente {Email} con ruoli [{Ruoli}]", email, string.Join(", ", ruoli));
        return Results.Created($"/api/admin/utenti/{utente.Id}", ToModel(utente, ruoli));
    }

    private static async Task<IResult> ModificaAsync(
        string id, ModificaUtenteRequest richiesta, HttpContext http, UserManager<ApplicationUser> userManager, ILogger<AdminLog> logger)
    {
        var errori = Valida(richiesta.Email, richiesta.Ruoli, passwordObbligatoria: false, richiesta.Password);
        if (errori.Count > 0)
        {
            return Results.ValidationProblem(errori);
        }

        var utente = await userManager.FindByIdAsync(id);
        if (utente is null)
        {
            return Results.NotFound();
        }

        var ruoliAttuali = await userManager.GetRolesAsync(utente);
        var ruoliNuovi = richiesta.Ruoli!.Distinct().ToList();
        var seStesso = utente.Id == userManager.GetUserId(http.User);

        // Losing the Admin role: never for oneself, and never for the last remaining Admin
        if (ruoliAttuali.Contains(Ruoli.Admin) && !ruoliNuovi.Contains(Ruoli.Admin))
        {
            if (seStesso)
            {
                return Conflitto("Non puoi toglierti il ruolo Admin.");
            }

            if (await UltimoAdminAsync(userManager))
            {
                return Conflitto("Non si può rimuovere l'ultimo Admin.");
            }
        }

        var email = richiesta.Email!.Trim();
        if (!string.Equals(utente.Email, email, StringComparison.Ordinal))
        {
            // The email is also the user name (as in the seed)
            utente.Email = email;
            utente.UserName = email;
            var aggiornato = await userManager.UpdateAsync(utente);
            if (!aggiornato.Succeeded)
            {
                return Results.ValidationProblem(ErroriIdentity(aggiornato));
            }
        }

        if (!string.IsNullOrEmpty(richiesta.Password))
        {
            var token = await userManager.GeneratePasswordResetTokenAsync(utente);
            var reset = await userManager.ResetPasswordAsync(utente, token, richiesta.Password);
            if (!reset.Succeeded)
            {
                return Results.ValidationProblem(ErroriIdentity(reset));
            }
        }

        var daAggiungere = ruoliNuovi.Except(ruoliAttuali).ToList();
        var daTogliere = ruoliAttuali.Except(ruoliNuovi).ToList();
        if (daTogliere.Count > 0)
        {
            await userManager.RemoveFromRolesAsync(utente, daTogliere);
        }

        if (daAggiungere.Count > 0)
        {
            await userManager.AddToRolesAsync(utente, daAggiungere);
        }

        if (daTogliere.Count > 0 || daAggiungere.Count > 0)
        {
            // Invalidate the refresh tokens: after a role change the user must sign in again with the updated permissions
            await userManager.UpdateSecurityStampAsync(utente);
        }

        logger.LogInformation("Modificato l'utente {Email} (ruoli +[{Aggiunti}] -[{Tolti}])", utente.Email, string.Join(", ", daAggiungere), string.Join(", ", daTogliere));
        return Results.Ok(ToModel(utente, ruoliNuovi));
    }

    private static async Task<IResult> EliminaAsync(
        string id, HttpContext http, UserManager<ApplicationUser> userManager, ILogger<AdminLog> logger)
    {
        var utente = await userManager.FindByIdAsync(id);
        if (utente is null)
        {
            return Results.NotFound();
        }

        if (utente.Id == userManager.GetUserId(http.User))
        {
            return Conflitto("Non puoi cancellare il tuo utente.");
        }

        if (await userManager.IsInRoleAsync(utente, Ruoli.Admin) && await UltimoAdminAsync(userManager))
        {
            return Conflitto("Non si può cancellare l'ultimo Admin.");
        }

        var eliminato = await userManager.DeleteAsync(utente);
        if (!eliminato.Succeeded)
        {
            return Results.ValidationProblem(ErroriIdentity(eliminato));
        }

        logger.LogInformation("Cancellato l'utente {Email}", utente.Email);
        return Results.NoContent();
    }

    private static async Task<bool> UltimoAdminAsync(UserManager<ApplicationUser> userManager)
        => (await userManager.GetUsersInRoleAsync(Ruoli.Admin)).Count <= 1;

    private static IResult Conflitto(string dettaglio)
        => Results.Problem(statusCode: StatusCodes.Status409Conflict, title: dettaglio);

    private static Dictionary<string, string[]> Valida(string? email, List<string>? ruoli, bool passwordObbligatoria, string? password)
    {
        var errori = new Dictionary<string, string[]>();
        var pulita = email?.Trim();
        if (string.IsNullOrEmpty(pulita) || pulita.Length > MaxEmailLength || !new EmailAddressAttribute().IsValid(pulita))
        {
            errori["email"] = ["Indicare un indirizzo email valido (max 256 caratteri)."];
        }

        if (ruoli is null)
        {
            errori["ruoli"] = ["Indicare i ruoli (anche vuoti)."];
        }
        else if (ruoli.Any(r => !Ruoli.Tutti.Contains(r)))
        {
            errori["ruoli"] = [$"Ruoli ammessi: {string.Join(", ", Ruoli.Tutti)}."];
        }

        if (passwordObbligatoria && string.IsNullOrEmpty(password))
        {
            errori["password"] = ["La password è obbligatoria."];
        }

        return errori;
    }

    private static Dictionary<string, string[]> ErroriIdentity(IdentityResult risultato)
        => risultato.Errors.GroupBy(e => e.Code).ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray());

    private static UtenteAdminModel ToModel(ApplicationUser utente, IEnumerable<string> ruoli)
        => new(utente.Id, utente.Email ?? utente.UserName ?? string.Empty, [.. ruoli.Order()]);

    public sealed record UtenteAdminModel(string Id, string Email, string[] Ruoli);

    public sealed record CreaUtenteRequest(string? Email, string? Password, List<string>? Ruoli);

    /// <summary>Empty password = leave unchanged; <c>Ruoli</c> replaces the whole set of roles of the user.</summary>
    public sealed record ModificaUtenteRequest(string? Email, string? Password, List<string>? Ruoli);

    /// <summary>Log category of the administration endpoints.</summary>
    public sealed class AdminLog;
}
