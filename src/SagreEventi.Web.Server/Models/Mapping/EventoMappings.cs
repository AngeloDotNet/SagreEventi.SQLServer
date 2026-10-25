using System.Linq.Expressions;
using SagreEventi.Shared.Models;
using SagreEventi.Web.Server.Models.Entities;

namespace SagreEventi.Web.Server.Models.Mapping;

public static class EventoMappings
{
    /// <summary>SQL-translatable projection from entity to DTO.</summary>
    public static readonly Expression<Func<Evento, EventoModel>> ToDto = e => new EventoModel
    {
        Id = e.Id,
        NomeEvento = e.NomeEvento,
        CittaEvento = e.CittaEvento,
        DataInizioEvento = e.DataInizioEvento,
        DataFineEvento = e.DataFineEvento,
        DescrizioneEvento = e.DescrizioneEvento,
        EventoConcluso = e.EventoConcluso,
        DataOraUltimaModifica = e.DataOraUltimaModifica,
        Stato = e.Stato,
        MotivoRifiuto = e.MotivoRifiuto,
    };

    /// <summary>
    /// Events visible to the public: the approved ones, plus the "tombstones" of withdrawn events (Rifiutato + Concluso),
    /// which let clients delete their local copy. A pending event, even an expired one, is never returned.
    /// </summary>
    public static readonly Expression<Func<Evento, bool>> VisibilePubblico = e =>
        e.Stato == StatoModerazione.Approvato || (e.Stato == StatoModerazione.Rifiutato && e.EventoConcluso);

    /// <summary>Like <see cref="ToDto"/> but for the public: tombstones expose only the identity, not the rejected content.</summary>
    public static readonly Expression<Func<Evento, EventoModel>> ToDtoPubblico = e => new EventoModel
    {
        Id = e.Id,
        NomeEvento = e.Stato == StatoModerazione.Approvato ? e.NomeEvento : string.Empty,
        CittaEvento = e.Stato == StatoModerazione.Approvato ? e.CittaEvento : string.Empty,
        DataInizioEvento = e.DataInizioEvento,
        DataFineEvento = e.DataFineEvento,
        DescrizioneEvento = e.Stato == StatoModerazione.Approvato ? e.DescrizioneEvento : string.Empty,
        EventoConcluso = e.EventoConcluso,
        DataOraUltimaModifica = e.DataOraUltimaModifica,
        Stato = e.Stato,
    };

    /// <summary>Creates a new entity from the DTO, including its Id.</summary>
    public static Evento ToEntity(this EventoModel dto)
    {
        var evento = new Evento { Id = dto.Id };
        evento.ApplyFrom(dto);
        return evento;
    }

    /// <summary>
    /// Copies the DTO fields (except the Id) onto the entity. State, rejection note and <c>EventoConcluso</c> are never copied
    /// from the client: only the server decides them (insert, review and automatic expiry).
    /// </summary>
    public static void ApplyFrom(this Evento evento, EventoModel dto)
    {
        evento.NomeEvento = dto.NomeEvento;
        evento.CittaEvento = dto.CittaEvento;
        evento.DataInizioEvento = dto.DataInizioEvento.GetValueOrDefault();
        evento.DataFineEvento = dto.DataFineEvento.GetValueOrDefault();
        evento.DescrizioneEvento = dto.DescrizioneEvento;
        evento.DataOraUltimaModifica = dto.DataOraUltimaModifica;
    }
}
