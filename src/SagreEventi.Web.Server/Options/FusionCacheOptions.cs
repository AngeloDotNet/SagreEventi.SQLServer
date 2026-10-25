using Microsoft.Extensions.Caching.Memory;

namespace SagreEventi.Web.Server.Options;

public class FusionCacheOptions
{
    public FusionCacheEntryOptions DefaultEntryOptions { get; set; } = new();
}

public class FusionCacheEntryOptions
{
    public TimeSpan Duration { get; set; }
    public CacheItemPriority Priority { get; set; }
    public bool IsFailSafeEnabled { get; set; }
    public TimeSpan FailSafeMaxDuration { get; set; }
    public TimeSpan FailSafeThrottleDuration { get; set; }
    public TimeSpan JitterMaxDuration { get; set; }
}