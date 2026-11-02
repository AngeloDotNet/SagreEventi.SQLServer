namespace SagreEventi.Web.Server.Options;

/// <summary>General application settings, <c>App</c> section of appsettings.</summary>
public sealed class AppOptions
{
    /// <summary>Name of the configuration section.</summary>
    public const string SectionName = "App";

    /// <summary>Value committed in appsettings.json: rejected at startup outside Development and Testing.</summary>
    public const string PlaceholderBaseUrl = "https://change-me.invalid";

    /// <summary>Public address of the web app, the base of every link written in e-mails. Never taken from the request Host header.</summary>
    public string PublicBaseUrl { get; set; } = PlaceholderBaseUrl;
}
