using Microsoft.EntityFrameworkCore;
using SagreEventi.Shared.Models;
using SagreEventi.Web.Server.Models.Entities;

using SagreEventi.Web.Server.Models.Mapping;
using SagreEventi.Web.Server.Models.Services.Infrastructure;
using ZiggyCreatures.Caching.Fusion;

namespace SagreEventi.Web.Server.Models.Services.Application;

/// <summary>Entity Framework Core implementation of <see cref="IEventiService"/>, with FusionCache for the public reads.</summary>
public class EfCoreEventiService(AppDbContext dbContext, IFusionCache cache) : IEventiService
{
    private const string CacheTag = "eventi";

    private readonly AppDbContext dbContext = dbContext;

    // TODO initials:
    // Add Eager Refresh for frequent GETs
    // Add Conditional Refresh for INSERT/UPDATE

    //TODO at a later time:
    // Evaluate (first choice) using Distributed Cache (Redis) for L1 + L2 + BackPlane + Auto Recovery
    // Evaluate (alternative choice) using Distributed Cache (SQLite) for L1 + L2 + BackPlane + Auto Recovery + DiskCache
    // Evaluate the use of Adaptive Caching (FusionCache) => https://github.com/ZiggyCreatures/FusionCache/blob/main/docs/AdaptiveCaching.md#%E2%80%8D-example-with-adaptive-caching

    /// <inheritdoc />
    public async Task<List<EventoModel>> GetEventiAsync(DateTime since, CancellationToken cancellationToken)
    {
        // Get the events modified after the 'since' date using the FusionCache cache (with Cache Stampede Protection + FailSafe)
        return await cache.GetOrSetAsync($"eventi_cache_key:{since.Ticks}", _
            => dbContext.Eventi.Where(EventoMappings.VisibilePubblico).Where(x => x.DataOraUltimaModifica > since)
                .Select(EventoMappings.ToDtoPubblico).ToListAsync(cancellationToken), options =>
                {
                    // Configure FusionCache, optionally changing the default options
                    //options.SetDuration(TimeSpan.FromMinutes(5));
                    //options.SetFailSafe(true, TimeSpan.FromMinutes(30), TimeSpan.FromMinutes(1));
                    options.IsFailSafeEnabled = true;
                    options.FailSafeMaxDuration = TimeSpan.FromMinutes(5);
                    options.FailSafeThrottleDuration = TimeSpan.FromMinutes(5);
                    options.JitterMaxDuration = TimeSpan.FromSeconds(30);
                }, tags: [CacheTag], token: cancellationToken);
    }

    /// <inheritdoc />
    public async Task<int> ConcludiScadutiAsync(DateTime adesso, CancellationToken cancellationToken)
    {
        var oggi = adesso.Date;

        // Targeted SQL update: only the events not yet concluded, the already concluded ones are not processed again.
        // The new timestamp is the clients' sync cursor: without it they would never receive the conclusion.
        var conclusi = await dbContext.Eventi
            .Where(x => !x.EventoConcluso && x.DataFineEvento < oggi)
            .ExecuteUpdateAsync(set => set
                .SetProperty(x => x.EventoConcluso, true)
                .SetProperty(x => x.DataOraUltimaModifica, adesso), cancellationToken);

        if (conclusi > 0)
        {
            await cache.RemoveByTagAsync(CacheTag, token: cancellationToken);
        }

        return conclusi;
    }

    /// <inheritdoc />
    public async Task<bool> UpdateEventiAsync(List<EventoModel> eventi, bool consentiModifiche, CancellationToken cancellationToken)
    {
        // One element per id (the most recent): two Adds of the same id in the same batch would cause a key error
        var unici = eventi
            .GroupBy(e => e.Id)
            .Select(g => g.OrderByDescending(e => e.DataOraUltimaModifica).First())
            .ToList();

        bool consentito;
        try
        {
            consentito = await ApplicaAsync(unici, consentiModifiche, cancellationToken);
        }
        catch (DbUpdateException)
        {
            // The same id was inserted concurrently by another request: retry once, it now exists
            dbContext.ChangeTracker.Clear();
            consentito = await ApplicaAsync(unici, consentiModifiche, cancellationToken);
        }

        await cache.RemoveByTagAsync(CacheTag, token: cancellationToken);
        return consentito;
    }

    private async Task<bool> ApplicaAsync(List<EventoModel> eventi, bool consentiModifiche, CancellationToken cancellationToken)
    {
        // The timestamp is decided by the server: it is the clients' sync cursor, a client-sent value (e.g. in 2099) would block it.
        // The client value is only used for the "most recent change wins" comparison.
        var ora = DateTime.UtcNow;
        var consentito = true;

        foreach (var todoitem in eventi)
        {
            var listaEventi = await dbContext.Eventi.FirstOrDefaultAsync(ev => ev.Id == todoitem.Id, cancellationToken);

            if (listaEventi == null)
            {
                if (!todoitem.EventoConcluso)
                {
                    var nuovo = todoitem.ToEntity();
                    nuovo.DataOraUltimaModifica = ora;
                    // The state never comes from the client: whoever can edit publishes immediately, the others go through the review
                    nuovo.Stato = consentiModifiche ? StatoModerazione.Approvato : StatoModerazione.InAttesa;
                    dbContext.Eventi.Add(nuovo);
                }
            }
            else if (listaEventi.EventoConcluso)
            {
                // A concluded event can no longer be edited by anyone, not even the Admin (this includes withdrawn ones): it is ignored
            }
            else
            {
                if (!consentiModifiche)
                {
                    // Re-sending exactly what is already stored (response lost after the insert) is harmless; a real change is not allowed
                    consentito &= StessoContenuto(listaEventi, todoitem);
                }
                else if (listaEventi.DataOraUltimaModifica < todoitem.DataOraUltimaModifica)
                {
                    listaEventi.ApplyFrom(todoitem);
                    listaEventi.DataOraUltimaModifica = ora;
                }
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return consentito;
    }

    /// <inheritdoc />
    public async Task<List<EventoModel>> GetDaRivedereAsync(StatoModerazione stato, int limite, CancellationToken cancellationToken)
    {
        return await dbContext.Eventi.AsNoTracking()
            .Where(x => x.Stato == stato)
            .OrderBy(x => x.DataOraUltimaModifica).ThenBy(x => x.Id)
            .Take(limite)
            .Select(EventoMappings.ToDto).ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task<List<EventoModel>> GetConclusiAsync(int limite, CancellationToken cancellationToken)
    {
        return await dbContext.Eventi.AsNoTracking()
            .Where(x => x.EventoConcluso)
            .OrderByDescending(x => x.DataFineEvento).ThenBy(x => x.Id)
            .Take(limite)
            .Select(EventoMappings.ToDto).ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task<int> ApprovaAsync(IReadOnlyCollection<string> ids, string revisore, CancellationToken cancellationToken)
    {
        var ora = DateTime.UtcNow;
        var eventi = await dbContext.Eventi.Where(x => ids.Contains(x.Id) && x.Stato != StatoModerazione.Approvato)
            .ToListAsync(cancellationToken);

        foreach (var evento in eventi)
        {
            evento.Stato = StatoModerazione.Approvato;
            evento.MotivoRifiuto = null;
            // A withdrawn event had been concluded to make it disappear from clients: once public again it no longer is, unless it has really passed
            evento.EventoConcluso = evento.DataFineEvento < ora.Date;
            Revisiona(evento, revisore, ora);
        }

        return await SalvaRevisioneAsync(eventi.Count, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<int> RifiutaAsync(IReadOnlyCollection<string> ids, string? motivo, string revisore, CancellationToken cancellationToken)
    {
        var ora = DateTime.UtcNow;
        var eventi = await dbContext.Eventi.Where(x => ids.Contains(x.Id) && x.Stato != StatoModerazione.Rifiutato)
            .ToListAsync(cancellationToken);

        foreach (var evento in eventi)
        {
            // Withdrawal of an approved event: the "tombstone" (Rifiutato + concluded) makes clients delete the local copy at the next pull
            if (evento.Stato == StatoModerazione.Approvato)
            {
                evento.EventoConcluso = true;
            }

            evento.Stato = StatoModerazione.Rifiutato;
            // Optional note, history only: it never goes out to whoever reported the event
            evento.MotivoRifiuto = string.IsNullOrWhiteSpace(motivo) ? null : motivo.Trim();
            Revisiona(evento, revisore, ora);
        }

        return await SalvaRevisioneAsync(eventi.Count, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<List<StatoEventoModel>> GetStatiAsync(IReadOnlyCollection<string> ids, CancellationToken cancellationToken)
    {
        return await dbContext.Eventi.AsNoTracking().Where(x => ids.Contains(x.Id))
            .Select(x => new StatoEventoModel
            {
                Id = x.Id,
                // The reporter is not told about the rejection: a rejected event still appears as pending
                Stato = x.Stato == StatoModerazione.Rifiutato ? StatoModerazione.InAttesa : x.Stato,
            }).ToListAsync(cancellationToken);
    }

    private static bool StessoContenuto(Evento e, EventoModel m) =>
        e.NomeEvento == m.NomeEvento && e.CittaEvento == m.CittaEvento && e.DescrizioneEvento == m.DescrizioneEvento
        && e.DataInizioEvento == m.DataInizioEvento.GetValueOrDefault() && e.DataFineEvento == m.DataFineEvento.GetValueOrDefault();

    private static void Revisiona(Evento evento, string revisore, DateTime ora)
    {
        evento.RevisionatoDa = revisore;
        evento.DataRevisione = ora;
        // New timestamp: it is the clients' sync cursor, so they receive the approved event or the tombstone of the withdrawn one
        evento.DataOraUltimaModifica = ora;
    }

    private async Task<int> SalvaRevisioneAsync(int modificati, CancellationToken cancellationToken)
    {
        if (modificati > 0)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await cache.RemoveByTagAsync(CacheTag, token: cancellationToken);
        }

        return modificati;
    }
}
