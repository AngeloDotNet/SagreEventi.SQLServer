using Microsoft.Extensions.Options;

namespace SagreEventi.Web.Server.Options;

/// <summary>Validates <see cref="AltchaOptions"/> at startup; the error messages name the configuration key to fix.</summary>
public sealed class AltchaOptionsValidator(IHostEnvironment environment) : IValidateOptions<AltchaOptions>
{
    /// <inheritdoc />
    public ValidateOptionsResult Validate(string? name, AltchaOptions options)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(options.HmacKey) || options.HmacKey.Length < AltchaOptions.MinKeyLength)
        {
            errors.Add($"Altcha:HmacKey (env Altcha__HmacKey) must be at least {AltchaOptions.MinKeyLength} characters long.");
        }
        else if (options.HmacKey.StartsWith(AltchaOptions.PlaceholderPrefix, StringComparison.OrdinalIgnoreCase)
            && !environment.IsDevelopment() && !environment.IsEnvironment("Testing"))
        {
            errors.Add("Altcha:HmacKey (env Altcha__HmacKey) is still the placeholder: set a real secret.");
        }

        if (options.MaxNumber is < 1_000 or > 10_000_000)
        {
            errors.Add("Altcha:MaxNumber must be between 1000 and 10000000.");
        }

        if (options.ChallengeValidityMinutes is < 1 or > 120)
        {
            errors.Add("Altcha:ChallengeValidityMinutes must be between 1 and 120.");
        }

        return errors.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(errors);
    }
}
