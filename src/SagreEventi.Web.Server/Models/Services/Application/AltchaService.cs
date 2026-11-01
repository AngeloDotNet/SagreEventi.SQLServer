using System.Collections.Concurrent;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using SagreEventi.Web.Server.Options;

namespace SagreEventi.Web.Server.Models.Services.Application;

/// <summary>
/// ALTCHA v1 proof of work: the challenge is <c>SHA-256(salt + number)</c> with a secret number, signed with HMAC-SHA256.
/// A solution is valid only if it matches a challenge issued by this server, has not expired and has not been used before.
/// </summary>
public sealed partial class AltchaService(IOptions<AltchaOptions> options, TimeProvider timeProvider) : IAltchaService
{
    /// <summary>Hash algorithm of the protocol; the only one accepted.</summary>
    public const string Algorithm = "SHA-256";

    /// <summary>Maximum accepted length of the base64 payload: a legitimate one is about 300 characters.</summary>
    public const int MaxPayloadLength = 1024;

    private const int SaltBytes = 12;
    private static readonly TimeSpan PruneInterval = TimeSpan.FromMinutes(1);
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    // Challenge hash -> expiry. Per process: with several replicas a solution could be reused once on each of them within its validity.
    private readonly ConcurrentDictionary<string, DateTimeOffset> _used = new(StringComparer.Ordinal);
    private long _lastPruneTicks;

    // The salt format is issued by this server only: anything else is rejected before computing hashes
    [GeneratedRegex(@"^[0-9a-f]{24}\?expires=[0-9]{1,12}&$", RegexOptions.CultureInvariant, matchTimeoutMilliseconds: 100)]
    private static partial Regex SaltFormat();

    /// <inheritdoc />
    public AltchaChallenge CreateChallenge()
    {
        var settings = options.Value;
        var expires = timeProvider.GetUtcNow().AddMinutes(settings.ChallengeValidityMinutes).ToUnixTimeSeconds();
        var salt = $"{Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(SaltBytes))}?expires={expires.ToString(CultureInfo.InvariantCulture)}&";
        var number = RandomNumberGenerator.GetInt32(0, settings.MaxNumber + 1);
        var challenge = HashChallenge(salt, number);

        return new AltchaChallenge(Algorithm, challenge, salt, Sign(challenge), settings.MaxNumber);
    }

    /// <inheritdoc />
    public AltchaVerificationResult Verify(string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload))
        {
            return AltchaVerificationResult.Missing;
        }

        var solution = Decode(payload);
        if (solution is null)
        {
            return AltchaVerificationResult.Malformed;
        }

        var settings = options.Value;
        if (solution.Algorithm != Algorithm
            || solution.Number is null or < 0 || solution.Number > settings.MaxNumber
            || solution.Salt is null || solution.Challenge is null || solution.Signature is null
            || solution.Challenge.Length != 64 || solution.Signature.Length != 64
            || !SaltFormat().IsMatch(solution.Salt))
        {
            return AltchaVerificationResult.Malformed;
        }

        var now = timeProvider.GetUtcNow();
        var expires = ParseExpiry(solution.Salt);
        if (expires < now)
        {
            return AltchaVerificationResult.Expired;
        }

        // Both the hash of the solved number and the signature of the challenge must match, compared in constant time
        var expectedChallenge = HashChallenge(solution.Salt, solution.Number.Value);
        if (!ConstantTimeEquals(expectedChallenge, solution.Challenge)
            || !ConstantTimeEquals(Sign(solution.Challenge), solution.Signature))
        {
            return AltchaVerificationResult.InvalidSolution;
        }

        Prune(now);
        return _used.TryAdd(solution.Challenge, expires) ? AltchaVerificationResult.Valid : AltchaVerificationResult.AlreadyUsed;
    }

    private static AltchaPayload? Decode(string payload)
    {
        if (payload.Length > MaxPayloadLength)
        {
            return null;
        }

        var buffer = new byte[MaxPayloadLength];
        if (!Convert.TryFromBase64String(payload, buffer, out var written))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<AltchaPayload>(buffer.AsSpan(0, written), JsonOptions);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    // The format check guarantees at most 12 digits
    private static DateTimeOffset ParseExpiry(string salt)
    {
        var start = salt.IndexOf('=') + 1;
        var seconds = long.Parse(salt.AsSpan(start, salt.Length - 1 - start), CultureInfo.InvariantCulture);
        return DateTimeOffset.FromUnixTimeSeconds(seconds);
    }

    private static string HashChallenge(string salt, long number)
        => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(salt + number.ToString(CultureInfo.InvariantCulture))));

    private string Sign(string challenge)
        => Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes(options.Value.HmacKey), Encoding.UTF8.GetBytes(challenge)));

    private static bool ConstantTimeEquals(string expected, string actual)
        => CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(expected), Encoding.ASCII.GetBytes(actual));

    // Removes the consumed solutions whose challenge has expired (they could not be accepted again anyway), at most once per interval
    private void Prune(DateTimeOffset now)
    {
        var last = Interlocked.Read(ref _lastPruneTicks);
        if (now.UtcTicks - last < PruneInterval.Ticks || Interlocked.CompareExchange(ref _lastPruneTicks, now.UtcTicks, last) != last)
        {
            return;
        }

        foreach (var (key, expires) in _used)
        {
            if (expires < now)
            {
                _used.TryRemove(key, out _);
            }
        }
    }

    private sealed record AltchaPayload(string? Algorithm, string? Challenge, long? Number, string? Salt, string? Signature);
}
