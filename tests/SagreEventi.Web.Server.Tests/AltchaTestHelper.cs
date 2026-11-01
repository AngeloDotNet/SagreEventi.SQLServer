using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using SagreEventi.Web.Server.Endpoints;
using SagreEventi.Web.Server.Models.Services.Application;

namespace SagreEventi.Web.Server.Tests;

/// <summary>Test-side client of the anti-bot proof of work: solves the challenges the way the ALTCHA widget does.</summary>
internal static class AltchaTestHelper
{
    /// <summary>HMAC key used by <see cref="ApiFactory"/> (not a real secret).</summary>
    public const string TestKey = "test-hmac-key-0123456789abcdef0123456789abcdef";

    /// <summary>Request header that tells the test pipeline not to add a proof automatically.</summary>
    public const string SkipHeader = "X-Test-Skip-Altcha";

    /// <summary>Finds the secret number by brute force and returns the base64 JSON payload the widget would send.</summary>
    public static string Solve(AltchaChallenge challenge)
    {
        for (var number = 0; number <= challenge.MaxNumber; number++)
        {
            var hash = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(challenge.Salt + number)));
            if (hash == challenge.Challenge)
            {
                return Encode(challenge, number);
            }
        }

        throw new InvalidOperationException("The challenge has no solution in the declared range.");
    }

    /// <summary>Builds the payload for the given number, correct or not.</summary>
    public static string Encode(AltchaChallenge challenge, long number)
        => Convert.ToBase64String(JsonSerializer.SerializeToUtf8Bytes(new
        {
            algorithm = challenge.Algorithm,
            challenge = challenge.Challenge,
            number,
            salt = challenge.Salt,
            signature = challenge.Signature,
        }));
}

/// <summary>Adds a freshly solved proof to the UpdateEventi requests that do not opt out.</summary>
internal sealed class AltchaTestStartupFilter : IStartupFilter
{
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
    {
        app.Use(async (context, continuation) =>
        {
            if (HttpMethods.IsPut(context.Request.Method)
                && context.Request.Path.Equals("/api/Eventi/UpdateEventi", StringComparison.OrdinalIgnoreCase)
                && !context.Request.Headers.ContainsKey(AltchaTestHelper.SkipHeader))
            {
                var service = context.RequestServices.GetRequiredService<IAltchaService>();
                context.Request.Headers[EventiEndpoints.AltchaHeaderName] = AltchaTestHelper.Solve(service.CreateChallenge());
            }

            await continuation();
        });

        next(app);
    };
}
