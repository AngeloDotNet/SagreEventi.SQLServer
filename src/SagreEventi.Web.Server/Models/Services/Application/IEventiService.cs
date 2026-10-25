using SagreEventi.Shared.Models;

namespace SagreEventi.Web.Server.Models.Services.Application;

public interface IEventiService
{
    /// <summary>Returns the publicly visible events modified after <paramref name="since"/> (approved ones plus tombstones of withdrawn ones), served through the cache.</summary>
    Task<List<EventoModel>> GetEventiAsync(DateTime since, CancellationToken cancellationToken = default);
    /// <summary>Concludes the not yet concluded events whose <c>DataFineEvento</c> is before the (UTC) day of <paramref name="adesso"/>, updating their timestamp (so clients receive them) and invalidating the cache. Returns how many were concluded.</summary>
    Task<int> ConcludiScadutiAsync(DateTime adesso, CancellationToken cancellationToken = default);
    /// <summary>Inserts the new events; existing ones are updated (last-write-wins) only if <paramref name="consentiModifiche"/> is true. Events already concluded on the server are ignored for everyone, and a client-sent <c>EventoConcluso</c> has no effect. Returns false if it found disallowed changes to existing events (new ones are inserted anyway).</summary>
    Task<bool> UpdateEventiAsync(List<EventoModel> eventi, bool consentiModifiche, CancellationToken cancellationToken = default);

    /// <summary>Events in a given state (<c>InAttesa</c> or <c>Rifiutato</c>) for reviewers, including the rejection note; oldest first.</summary>
    Task<List<EventoModel>> GetDaRivedereAsync(StatoModerazione stato, int limite, CancellationToken cancellationToken = default);
    /// <summary>All the concluded (expired or withdrawn) events in any moderation state, for administrators, including the rejection note; most recently ended first.</summary>
    Task<List<EventoModel>> GetConclusiAsync(int limite, CancellationToken cancellationToken = default);
    /// <summary>Approves the given events (including rejected or withdrawn ones). Returns how many were changed.</summary>
    Task<int> ApprovaAsync(IReadOnlyCollection<string> ids, string revisore, CancellationToken cancellationToken = default);
    /// <summary>Rejects pending events; an already approved event is withdrawn (Rifiutato + concluded, so clients delete it). The <paramref name="motivo"/> note is optional and is kept only in the database as history. Returns how many were changed.</summary>
    Task<int> RifiutaAsync(IReadOnlyCollection<string> ids, string? motivo, string revisore, CancellationToken cancellationToken = default);
    /// <summary>Moderation state of the given ids, as seen by the reporter: a rejection is not revealed (it appears as <c>InAttesa</c>) and the note is never returned. Unknown ids are omitted.</summary>
    Task<List<StatoEventoModel>> GetStatiAsync(IReadOnlyCollection<string> ids, CancellationToken cancellationToken = default);
}
