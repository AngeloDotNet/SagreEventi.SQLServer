namespace SagreEventi.Web.Server.Options;

/// <summary>Moderation notices, <c>Moderazione</c> section of appsettings. Read through <c>IOptionsMonitor</c>: changes also apply at runtime.</summary>
public sealed class ModerazioneOptions
{
    /// <summary>Name of the configuration section.</summary>
    public const string SectionName = "Moderazione";

    /// <summary>Lowest interval accepted, in minutes.</summary>
    public const int IntervalloMinimoMinuti = 5;

    /// <summary>How often, in minutes, the moderators are told about new reports waiting for review.</summary>
    public int AvvisoIntervalloMinuti { get; set; } = 60;

    /// <summary>The notice interval as a <see cref="TimeSpan"/>.</summary>
    public TimeSpan Intervallo => TimeSpan.FromMinutes(AvvisoIntervalloMinuti);
}
