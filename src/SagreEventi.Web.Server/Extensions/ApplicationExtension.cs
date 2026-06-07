using Microsoft.Extensions.Caching.Memory;
using ZiggyCreatures.Caching.Fusion;

namespace SagreEventi.Web.Server.Extensions;

public static class ApplicationExtension
{
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