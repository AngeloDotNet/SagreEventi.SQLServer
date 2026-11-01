namespace SagreEventi.Web.Server.Options;

/// <summary>Anti-bot proof of work (ALTCHA v1 protocol), <c>Altcha</c> section of appsettings. The real key comes from the <c>Altcha__HmacKey</c> environment variable.</summary>
public sealed class AltchaOptions
{
    /// <summary>Name of the configuration section.</summary>
    public const string SectionName = "Altcha";

    /// <summary>Prefix of every placeholder key (appsettings.json, .env.example): keys starting with it are rejected at startup outside Development and Testing.</summary>
    public const string PlaceholderPrefix = "CHANGE-ME";

    /// <summary>Placeholder committed in appsettings.json.</summary>
    public const string PlaceholderKey = PlaceholderPrefix + "-placeholder-not-a-real-key-0000";

    /// <summary>Minimum length, in characters, of the HMAC key.</summary>
    public const int MinKeyLength = 32;

    /// <summary>Secret used to sign the challenges. Never log it, never commit a real value.</summary>
    public string HmacKey { get; set; } = PlaceholderKey;

    /// <summary>Upper bound of the secret number: the client needs on average half of this many hashes to solve a challenge.</summary>
    public int MaxNumber { get; set; } = 300_000;

    /// <summary>How long, in minutes, a challenge can be solved and submitted.</summary>
    public int ChallengeValidityMinutes { get; set; } = 10;
}
