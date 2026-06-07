using Microsoft.EntityFrameworkCore;
using SagreEventi.Shared.Models;
using SagreEventi.Web.Server.Extensions;
using SagreEventi.Web.Server.Models.Services.Infrastructure;
using ZiggyCreatures.Caching.Fusion;

namespace SagreEventi.Web.Server.Models.Services.Application;

public class EfCoreEventiService(AppDbContext dbContext) : IEventiService
{
    private readonly AppDbContext dbContext = dbContext;
    private readonly FusionCache cache = ApplicationExtension.GetFusionCacheDefaultOptions();

    // TODO initials:
    // Add Eager Refresh for frequent GETs
    // Add Conditional Refresh for INSERT/UPDATE

    //TODO at a later time:
    // Evaluate (first choice) using Distributed Cache (Redis) for L1 + L2 + BackPlane + Auto Recovery
    // Evaluate (alternative choice) using Distributed Cache (SQLite) for L1 + L2 + BackPlane + Auto Recovery + DiskCache
    // Evaluate the use of Adaptive Caching (FusionCache) => https://github.com/ZiggyCreatures/FusionCache/blob/main/docs/AdaptiveCaching.md#%E2%80%8D-example-with-adaptive-caching

    public async Task<List<EventoModel>> GetEventiAsync(DateTime since, CancellationToken cancellationToken)
    {
        // Recupero gli eventi modificati dopo la data 'since' utilizzando la cache FusionCache (con Cache Stampede Protection + FailSafe)
        return await cache.GetOrSetAsync("eventi_cache_key", _
            => dbContext.Eventi.Where(x => x.DataOraUltimaModifica > since)
                .ToListAsync(cancellationToken), options =>
                {
                    // Configuro FusionCache, modificando eventualmente le opzioni di default
                    //options.SetDuration(TimeSpan.FromMinutes(5));
                    //options.SetFailSafe(true, TimeSpan.FromMinutes(30), TimeSpan.FromMinutes(1));
                    options.IsFailSafeEnabled = true;
                    options.FailSafeMaxDuration = TimeSpan.FromMinutes(5);
                    options.FailSafeThrottleDuration = TimeSpan.FromMinutes(5);
                    options.JitterMaxDuration = TimeSpan.FromSeconds(30);
                }, cancellationToken);
    }

    public async Task<List<EventoModel>> GetEventiScadutiAsync(DateTime dataOdierna, CancellationToken cancellationToken)
    {
        // Recupero gli eventi scaduti utilizzando FusionCache (con Cache Stampede Protection + FailSafe)
        return await cache.GetOrSetAsync("eventi_scaduti_cache_key", _
            => dbContext.Eventi.Where(x => dataOdierna > x.DataFineEvento)
                .ToListAsync(cancellationToken), options =>
                {
                    // Configuro FusionCache, modificando eventualmente le opzioni di default
                    //options.SetDuration(TimeSpan.FromMinutes(5));
                    options.SetFailSafe(true, TimeSpan.FromMinutes(30), TimeSpan.FromMinutes(1));
                    options.JitterMaxDuration = TimeSpan.FromSeconds(30);
                }, cancellationToken);
    }

    public async Task UpdateEventoAsync(EventoModel evento, CancellationToken cancellationToken)
    {
        var avvenimento = await dbContext.Eventi.FindAsync([evento.Id], cancellationToken);

        avvenimento.NomeEvento = evento.NomeEvento;
        avvenimento.CittaEvento = evento.CittaEvento;
        avvenimento.DataInizioEvento = evento.DataInizioEvento;
        avvenimento.DataFineEvento = evento.DataFineEvento;
        avvenimento.DescrizioneEvento = evento.DescrizioneEvento;
        avvenimento.EventoConcluso = true;

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateEventiAsync(List<EventoModel> eventi, CancellationToken cancellationToken)
    {
        foreach (var todoitem in eventi)
        {
            var listaEventi = await dbContext.Eventi.FirstOrDefaultAsync(ev => ev.Id == todoitem.Id, cancellationToken);

            if (listaEventi == null)
            {
                if (!todoitem.EventoConcluso)
                {
                    dbContext.Eventi.Add(todoitem);
                }
            }
            else
            {
                if (listaEventi.DataOraUltimaModifica < todoitem.DataOraUltimaModifica)
                {
                    dbContext.Entry(listaEventi).CurrentValues.SetValues(todoitem);
                }
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}