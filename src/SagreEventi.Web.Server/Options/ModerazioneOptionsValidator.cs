using Microsoft.Extensions.Options;

namespace SagreEventi.Web.Server.Options;

/// <summary>Validates <see cref="ModerazioneOptions"/> at startup.</summary>
public sealed class ModerazioneOptionsValidator : IValidateOptions<ModerazioneOptions>
{
    /// <inheritdoc />
    public ValidateOptionsResult Validate(string? name, ModerazioneOptions options)
        => options.AvvisoIntervalloMinuti < ModerazioneOptions.IntervalloMinimoMinuti
            ? ValidateOptionsResult.Fail($"Moderazione:AvvisoIntervalloMinuti (env Moderazione__AvvisoIntervalloMinuti) must be at least {ModerazioneOptions.IntervalloMinimoMinuti}.")
            : ValidateOptionsResult.Success;
}
