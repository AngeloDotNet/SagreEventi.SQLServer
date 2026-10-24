using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SagreEventi.Web.Server.Models.Identity;

namespace SagreEventi.Web.Server.Tests;

/// <summary>Security tests of the Identity seed: the sample passwords of appsettings.json must not create accounts outside Development.</summary>
public class SeedSicurezzaTests
{
    private const string EditorEmail = "editor@sagreeventi.local";
    private const string PasswordDiEsempio = "Editor!12345";

    private static async Task<ApplicationUser?> EditorSeminatoAsync(string ambiente, string password)
    {
        using var factory = new ApiFactory().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment(ambiente);
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Identity:Editor:Email"] = EditorEmail,
                ["Identity:Editor:Password"] = password,
            }));
        });

        using var scope = factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().FindByEmailAsync(EditorEmail);
    }

    [Theory]
    [InlineData("Production")]
    [InlineData("Testing")]
    public async Task Seed_FuoriDaDevelopmentNonCreaUtentiConPasswordDiEsempio(string ambiente)
    {
        Assert.Null(await EditorSeminatoAsync(ambiente, PasswordDiEsempio));
    }

    [Fact]
    public async Task Seed_InDevelopmentCreaUtentiConPasswordDiEsempio()
    {
        Assert.NotNull(await EditorSeminatoAsync("Development", PasswordDiEsempio));
    }

    [Fact]
    public async Task Seed_FuoriDaDevelopmentCreaUtentiConPasswordPropria()
    {
        Assert.NotNull(await EditorSeminatoAsync("Production", "Una-Password-Propria!7"));
    }
}
