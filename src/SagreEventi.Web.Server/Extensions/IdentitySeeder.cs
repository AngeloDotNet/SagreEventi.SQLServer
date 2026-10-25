using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SagreEventi.Web.Server.Models.Services.Infrastructure;
using SagreEventi.Web.Server.Models.Identity;

namespace SagreEventi.Web.Server.Extensions;

public static class IdentitySeeder
{
    private static readonly HashSet<string> PasswordDiEsempio = new(StringComparer.Ordinal) { "Admin!12345", "Editor!12345" };

    /// <summary>
    /// Applies the migrations (if <c>Database:MigraAllAvvio</c> is set), creates the roles and the Admin and Editor users
    /// configured in <c>Identity:Admin</c> / <c>Identity:Editor</c> (<c>Email</c> and <c>Password</c>).
    /// </summary>
    public static async Task SeedIdentityAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var provider = scope.ServiceProvider;
        var configuration = provider.GetRequiredService<IConfiguration>();
        var logger = provider.GetRequiredService<ILoggerFactory>().CreateLogger("IdentitySeeder");
        var ambiente = provider.GetRequiredService<IHostEnvironment>();
        if (configuration.GetValue<bool>("Database:MigraAllAvvio"))
        {
            // SQL Server only: the tests use SQLite with a hand-built schema
            var db = provider.GetRequiredService<AppDbContext>();
            if (db.Database.IsSqlServer())
            {
                await db.Database.MigrateAsync();
            }
        }

        var roleManager = provider.GetRequiredService<RoleManager<IdentityRole>>();
        var userManager = provider.GetRequiredService<UserManager<ApplicationUser>>();

        foreach (var ruolo in Ruoli.Tutti)
        {
            if (!await roleManager.RoleExistsAsync(ruolo))
            {
                await roleManager.CreateAsync(new IdentityRole(ruolo));
            }
        }

        await CreaUtenteAsync(userManager, logger, configuration, ambiente, "Admin", Ruoli.Admin);
        await CreaUtenteAsync(userManager, logger, configuration, ambiente, "Editor", Ruoli.Editor);
    }

    private static async Task CreaUtenteAsync(UserManager<ApplicationUser> userManager, ILogger logger, IConfiguration configuration, IHostEnvironment ambiente, string sezione, string ruolo)
    {
        var email = configuration[$"Identity:{sezione}:Email"];
        var password = configuration[$"Identity:{sezione}:Password"];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            return;
        }

        // The sample passwords shipped in appsettings.json are public: outside Development they must not create an account
        if (!ambiente.IsDevelopment() && PasswordDiEsempio.Contains(password))
        {
            logger.LogWarning("Utente {Sezione} non creato: la password è quella di esempio di appsettings.json, impostarne una propria in appsettings.local.json o nelle variabili d'ambiente", sezione);
            return;
        }

        var utente = await userManager.FindByEmailAsync(email);
        if (utente is null)
        {
            utente = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true };
            var risultato = await userManager.CreateAsync(utente, password);
            if (!risultato.Succeeded)
            {
                logger.LogError("Creazione {Sezione} fallita: {Errori}", sezione, string.Join("; ", risultato.Errors.Select(e => e.Description)));
                return;
            }
        }

        if (!await userManager.IsInRoleAsync(utente, ruolo))
        {
            await userManager.AddToRoleAsync(utente, ruolo);
        }
    }
}

/// <summary>Seeds the roles and the first Admin when the application starts.</summary>
public sealed class IdentitySeedHostedService(IServiceProvider services) : IHostedService
{
    /// <summary>Runs the identity seed at application startup.</summary>
    public Task StartAsync(CancellationToken cancellationToken) => services.SeedIdentityAsync();

    /// <summary>Nothing to do on shutdown.</summary>
    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
