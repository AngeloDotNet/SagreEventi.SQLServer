namespace SagreEventi.Web.Server.Options;

/// <summary>Automatic event expiry, <c>Eventi</c> section of appsettings. Read through <c>IOptionsMonitor</c>: changes also apply at runtime.</summary>
public class ScadenzaEventiOptions
{
    public const double IntervalloMinutiDefault = 60;

    /// <summary>How often, in minutes, the service concludes events whose end date has passed (fractions allowed). Non-positive values fall back to the default.</summary>
    public double ScadenzaIntervalloMinuti { get; set; } = IntervalloMinutiDefault;

    /// <summary>The expiry interval as a <see cref="TimeSpan"/>, using the default when the configured value is not positive.</summary>
    public TimeSpan Intervallo => TimeSpan.FromMinutes(ScadenzaIntervalloMinuti > 0 ? ScadenzaIntervalloMinuti : IntervalloMinutiDefault);
}
