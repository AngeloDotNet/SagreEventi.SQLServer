using Microsoft.Extensions.Caching.Memory;

namespace SagreEventi.Web.Server.Options;

/// <summary>Cache options bound from the <c>FusionCache</c> configuration section.</summary>
public sealed class FusionCacheOptions
{
    public FusionCacheEntryOptions DefaultEntryOptions { get; set; } = new();
}

/// <summary>Default options of a cache entry.</summary>
public sealed class FusionCacheEntryOptions
{
    public TimeSpan Duration { get; set; }
    public CacheItemPriority Priority { get; set; }
    public bool IsFailSafeEnabled { get; set; }
    public TimeSpan FailSafeMaxDuration { get; set; }
    public TimeSpan FailSafeThrottleDuration { get; set; }
    public TimeSpan JitterMaxDuration { get; set; }
}