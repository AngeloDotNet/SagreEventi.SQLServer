using SagreEventi.Web.Server.Models.Services.Application;

namespace SagreEventi.Web.Server.Tests;

/// <summary>Rounding of the client-chosen <c>since</c> value that feeds the cache key of <c>GetEventi</c>.</summary>
public class ArrotondamentoSinceTests
{
    [Fact]
    public void RoundsDownToTheMinuteKeepingTheKind()
    {
        var value = new DateTime(2026, 10, 31, 12, 34, 56, 789, DateTimeKind.Utc);

        var rounded = EfCoreEventiService.ArrotondaAlMinuto(value);

        Assert.Equal(new DateTime(2026, 10, 31, 12, 34, 0, DateTimeKind.Utc), rounded);
        Assert.Equal(DateTimeKind.Utc, rounded.Kind);
    }

    [Fact]
    public void ValuesInTheSameMinuteShareTheSameResult()
    {
        var a = new DateTime(2026, 10, 31, 12, 34, 0, DateTimeKind.Utc);
        var b = a.AddSeconds(59).AddTicks(9999);

        Assert.Equal(EfCoreEventiService.ArrotondaAlMinuto(a), EfCoreEventiService.ArrotondaAlMinuto(b));
        Assert.NotEqual(EfCoreEventiService.ArrotondaAlMinuto(a), EfCoreEventiService.ArrotondaAlMinuto(a.AddMinutes(1)));
    }

    [Fact]
    public void ExtremeValuesAreHandled()
    {
        Assert.Equal(DateTime.MinValue, EfCoreEventiService.ArrotondaAlMinuto(DateTime.MinValue));
        Assert.True(EfCoreEventiService.ArrotondaAlMinuto(DateTime.MaxValue) <= DateTime.MaxValue);
    }
}
