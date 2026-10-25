using SagreEventi.Shared.Models;

namespace SagreEventi.Web.Server.Models.Entities;

/// <summary>
/// Entity persisted in the <c>Eventi</c> table. The contract with clients is <c>EventoModel</c> (DTO in SagreEventi.Shared).
/// </summary>
public class Evento
{
    public string Id { get; set; } = string.Empty;
    public string NomeEvento { get; set; } = string.Empty;
    public string CittaEvento { get; set; } = string.Empty;
    public DateTime DataInizioEvento { get; set; }
    public DateTime DataFineEvento { get; set; }
    public string DescrizioneEvento { get; set; } = string.Empty;
    public bool EventoConcluso { get; set; }
    public DateTime DataOraUltimaModifica { get; set; }

    /// <summary>Moderation state; the default value (0) is <c>InAttesa</c>, also for rows that predate the migration.</summary>
    public StatoModerazione Stato { get; set; }
    public string? MotivoRifiuto { get; set; }
    /// <summary>Email of the reviewer who approved or rejected the event.</summary>
    public string? RevisionatoDa { get; set; }
    public DateTime? DataRevisione { get; set; }
}
