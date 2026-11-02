using Microsoft.Extensions.Options;

namespace SagreEventi.Web.Server.Options;

/// <summary>Validates <see cref="AppOptions"/> at startup.</summary>
public sealed class AppOptionsValidator(IHostEnvironment environment) : IValidateOptions<AppOptions>
{
    /// <inheritdoc />
    public ValidateOptionsResult Validate(string? name, AppOptions options)
    {
        var diProva = environment.IsDevelopment() || environment.IsEnvironment("Testing");

        // The raw text goes into the body of the e-mails: no spaces or control characters, whatever the URI parser tolerates
        if (string.IsNullOrEmpty(options.PublicBaseUrl) || options.PublicBaseUrl.Any(c => char.IsControl(c) || char.IsWhiteSpace(c))
            || !Uri.TryCreate(options.PublicBaseUrl, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttps && !(diProva && uri.Scheme == Uri.UriSchemeHttp))
            || !string.IsNullOrEmpty(uri.UserInfo) || !string.IsNullOrEmpty(uri.Query) || !string.IsNullOrEmpty(uri.Fragment))
        {
            return ValidateOptionsResult.Fail("App:PublicBaseUrl (env App__PublicBaseUrl) must be an absolute https URL without credentials, query or fragment.");
        }

        return uri.Host.EndsWith(".invalid", StringComparison.OrdinalIgnoreCase) && !diProva
            ? ValidateOptionsResult.Fail("App:PublicBaseUrl (env App__PublicBaseUrl) is still the placeholder: set the real public address.")
            : ValidateOptionsResult.Success;
    }
}
