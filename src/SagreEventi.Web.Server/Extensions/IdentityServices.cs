using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using SagreEventi.Web.Server.Models.Identity;
using SagreEventi.Web.Server.Models.Services.Infrastructure;

namespace SagreEventi.Web.Server.Extensions;

public static class IdentityServices
{
    public const string AuthRateLimitPolicy = "auth";
    public const int MinPasswordLength = 10;

    /// <summary>Registers Identity (API endpoints, roles, EF stores), the authorization policies, the seed service and the rate limit for the auth endpoints.</summary>
    public static IServiceCollection AddIdentityServices(this IServiceCollection services)
    {
        services.AddIdentityApiEndpoints<ApplicationUser>(options => options.Password.RequiredLength = MinPasswordLength)
            .AddRoles<IdentityRole>()
            .AddEntityFrameworkStores<AppDbContext>();

        services.AddHostedService<IdentitySeedHostedService>();

        services.AddAuthorizationBuilder()
            .AddPolicy(Policies.PuoModificare, policy => policy.RequireRole(Ruoli.Admin, Ruoli.Editor))
            .AddPolicy(Policies.SoloAdmin, policy => policy.RequireRole(Ruoli.Admin));

        // Limit the attempts on /api/auth (login, refresh): 10 requests per minute per IP address
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy(AuthRateLimitPolicy, httpContext => RateLimitPartition.GetFixedWindowLimiter(
                httpContext.Connection.RemoteIpAddress?.ToString() ?? "sconosciuto",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 10,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                }));
        });

        return services;
    }

    /// <summary>
    /// Exposes the Identity login/refresh/account management endpoints under /api/auth.
    /// Public registration is disabled unless <c>Identity:RegistrazionePubblica</c> is true.
    /// </summary>
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app, IConfiguration configuration)
    {
        var group = app.MapGroup("/api/auth")
            .WithTags("Auth")
            .RequireRateLimiting(AuthRateLimitPolicy);

        if (!configuration.GetValue<bool>("Identity:RegistrazionePubblica"))
        {
            group.AddEndpointFilter(async (context, next) =>
                context.HttpContext.Request.Path.Value!.EndsWith("/register", StringComparison.OrdinalIgnoreCase)
                    ? Results.NotFound()
                    : await next(context));
        }

        group.MapIdentityApi<ApplicationUser>();

        // Current user with the roles refreshed from the DB: the client needs it to show or hide the restricted actions
        group.MapGet("/me", async (ClaimsPrincipal principal, UserManager<ApplicationUser> userManager) =>
        {
            var utente = await userManager.GetUserAsync(principal);
            if (utente is null)
            {
                return Results.Unauthorized();
            }

            var ruoli = await userManager.GetRolesAsync(utente);
            return Results.Ok(new UtenteCorrenteResponse(utente.Email ?? utente.UserName ?? string.Empty, [.. ruoli]));
        }).RequireAuthorization().DisableRateLimiting();

        return app;
    }

    public sealed record UtenteCorrenteResponse(string Email, string[] Ruoli);
}
