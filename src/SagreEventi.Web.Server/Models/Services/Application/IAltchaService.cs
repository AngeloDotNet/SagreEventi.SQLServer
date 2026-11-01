namespace SagreEventi.Web.Server.Models.Services.Application;

/// <summary>Issues and verifies the anti-bot proof-of-work challenges (ALTCHA v1 protocol, implemented without external libraries).</summary>
public interface IAltchaService
{
    /// <summary>Creates a new signed challenge that expires after the configured validity.</summary>
    AltchaChallenge CreateChallenge();

    /// <summary>
    /// Verifies a solution sent by the client (the base64 JSON produced by the widget) and, if valid, consumes it:
    /// the same solution is accepted only once. The replay memory is per process.
    /// </summary>
    /// <param name="payload">Base64 of the JSON <c>{algorithm, challenge, number, salt, signature}</c>; untrusted input.</param>
    AltchaVerificationResult Verify(string? payload);
}
