namespace SagreEventi.Shared.Models;

/// <summary>State of a reported event, returned to whoever reported it (<c>GET /api/Eventi/GetStati</c>). A rejection is not communicated: it appears as <c>InAttesa</c>.</summary>
public class StatoEventoModel
{
    public string Id { get; set; } = string.Empty;
    public StatoModerazione Stato { get; set; }
}

/// <summary>Bulk approval request (<c>POST /api/Eventi/Revisione/Approva</c>).</summary>
public class ApprovaEventiRequest
{
    public List<string> Ids { get; set; } = [];
}

/// <summary>Bulk rejection request, or withdrawal if already approved (<c>POST /api/Eventi/Revisione/Rifiuta</c>).</summary>
public class RifiutaEventiRequest
{
    public List<string> Ids { get; set; } = [];
    /// <summary>Optional note (max 500 characters), stored only as history and visible only to Admin and Editor.</summary>
    public string? Motivo { get; set; }
}

/// <summary>Number of events actually changed by a review (unknown ids or ids already in the requested state are ignored).</summary>
public class RevisioneEsito
{
    public int Modificati { get; set; }
}
