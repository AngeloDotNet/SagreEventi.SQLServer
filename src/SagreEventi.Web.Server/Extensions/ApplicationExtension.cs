using Microsoft.Extensions.Caching.Memory;
using ZiggyCreatures.Caching.Fusion;

namespace SagreEventi.Web.Server.Extensions;

/// <summary>Configures the HTTP pipeline of the application.</summary>
public static class ApplicationExtension
{
    /// <summary>Creates a FusionCache instance with the default entry options (5 minutes, low priority).</summary>
    public static FusionCache GetFusionCacheDefaultOptions()
    {
        var cache = new FusionCache(new FusionCacheOptions()
        {
            DefaultEntryOptions = new FusionCacheEntryOptions
            {
                Duration = TimeSpan.FromMinutes(5),
                Priority = CacheItemPriority.Low
            }
        });

        return cache;
    }
}