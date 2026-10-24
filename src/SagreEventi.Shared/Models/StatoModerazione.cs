using System.Text.Json.Serialization;

namespace SagreEventi.Shared.Models;

/// <summary>Outcome of the review of a reported event. Value 0 is the initial state: events that existed at migration time start as pending.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum StatoModerazione
{
    InAttesa = 0,
    Approvato = 1,
    Rifiutato = 2,
}
