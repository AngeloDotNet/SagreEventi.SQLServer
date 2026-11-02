namespace SagreEventi.Web.Server.Models.Services.Application;

/// <summary>What the moderators have still to be told about: the reports waiting for review that no notice has included yet, and how many are waiting in all.</summary>
/// <param name="IdNuove">Ids of the pending reports not notified yet.</param>
/// <param name="TotaleInAttesa">All the pending reports (the same count as the "Gestione" counter), notified or not.</param>
public sealed record NotificaModerazione(IReadOnlyList<string> IdNuove, int TotaleInAttesa)
{
    /// <summary>How many pending reports are new, that is not notified yet.</summary>
    public int Nuove => IdNuove.Count;
}
