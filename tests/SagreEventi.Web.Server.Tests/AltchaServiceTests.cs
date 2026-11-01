using System.Text;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using SagreEventi.Web.Server.Models.Services.Application;
using SagreEventi.Web.Server.Options;

namespace SagreEventi.Web.Server.Tests;

/// <summary>Unit tests of the anti-bot proof of work: valid solutions, forgeries, expiry, replay and hostile payloads.</summary>
public class AltchaServiceTests
{
    private const string OtherKey = "another-hmac-key-0123456789abcdef0123456789";

    private sealed class FakeTime(DateTimeOffset start) : TimeProvider
    {
        private DateTimeOffset _now = start;

        public override DateTimeOffset GetUtcNow() => _now;

        public void Advance(TimeSpan by) => _now += by;
    }

    private static readonly DateTimeOffset Start = new(2026, 10, 31, 12, 0, 0, TimeSpan.Zero);

    private static AltchaService Create(FakeTime? time = null, string key = AltchaTestHelper.TestKey, int validityMinutes = 10)
        => new(Microsoft.Extensions.Options.Options.Create(new AltchaOptions { HmacKey = key, MaxNumber = 1000, ChallengeValidityMinutes = validityMinutes }), time ?? new FakeTime(Start));

    private static string Base64(string text) => Convert.ToBase64String(Encoding.UTF8.GetBytes(text));

    [Fact]
    public void CreateChallenge_ReturnsSignedChallengeInV1Shape()
    {
        var challenge = Create().CreateChallenge();

        Assert.Equal("SHA-256", challenge.Algorithm);
        Assert.Equal(64, challenge.Challenge.Length);
        Assert.Equal(64, challenge.Signature.Length);
        Assert.Equal(1000, challenge.MaxNumber);
        Assert.Matches(@"^[0-9a-f]{24}\?expires=\d+&$", challenge.Salt);
    }

    [Fact]
    public void CreateChallenge_ReturnsDifferentChallengesEachTime()
    {
        var service = Create();

        Assert.NotEqual(service.CreateChallenge().Challenge, service.CreateChallenge().Challenge);
    }

    [Fact]
    public void Verify_AcceptsSolvedChallengeOnce()
    {
        var service = Create();
        var payload = AltchaTestHelper.Solve(service.CreateChallenge());

        Assert.Equal(AltchaVerificationResult.Valid, service.Verify(payload));
        Assert.Equal(AltchaVerificationResult.AlreadyUsed, service.Verify(payload));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Verify_MissingPayload(string? payload)
        => Assert.Equal(AltchaVerificationResult.Missing, Create().Verify(payload));

    [Theory]
    [InlineData("!!!not-base64!!!")]
    [InlineData("<script>alert(1)</script>")]
    [InlineData("' OR 1=1 --")]
    [InlineData("../../etc/passwd")]
    public void Verify_NonBase64Payload_IsMalformed(string payload)
        => Assert.Equal(AltchaVerificationResult.Malformed, Create().Verify(payload));

    [Theory]
    [InlineData("not json")]
    [InlineData("[1,2,3]")]
    [InlineData("null")]
    [InlineData("{}")]
    [InlineData("{\"number\":\"abc\"}")]
    [InlineData("{\"number\":1.5,\"algorithm\":\"SHA-256\"}")]
    [InlineData("{\"algorithm\":\"SHA-256\",\"challenge\":\"a\",\"number\":1,\"salt\":\"b\",\"signature\":\"c\"}")]
    public void Verify_JsonThatIsNotASolution_IsMalformed(string json)
        => Assert.Equal(AltchaVerificationResult.Malformed, Create().Verify(Base64(json)));

    [Fact]
    public void Verify_OversizedPayload_IsMalformedWithoutDecoding()
        => Assert.Equal(AltchaVerificationResult.Malformed, Create().Verify(new string('A', AltchaService.MaxPayloadLength + 1)));

    [Fact]
    public void Verify_WrongNumber_IsInvalidSolution()
    {
        var service = Create();
        var challenge = service.CreateChallenge();
        var correct = AltchaTestHelper.Solve(challenge);
        var correctNumber = ExtractNumber(correct);

        Assert.Equal(AltchaVerificationResult.InvalidSolution, service.Verify(AltchaTestHelper.Encode(challenge, (correctNumber + 1) % 1000)));
    }

    [Fact]
    public void Verify_AlteredSignature_IsInvalidSolution()
    {
        var service = Create();
        var challenge = service.CreateChallenge();
        var number = ExtractNumber(AltchaTestHelper.Solve(challenge));
        var forged = challenge with { Signature = new string(challenge.Signature[0] == 'a' ? 'b' : 'a', 1) + challenge.Signature[1..] };

        Assert.Equal(AltchaVerificationResult.InvalidSolution, service.Verify(AltchaTestHelper.Encode(forged, number)));
    }

    [Fact]
    public void Verify_ChallengeSignedWithAnotherKey_IsInvalidSolution()
    {
        var foreign = Create(key: OtherKey).CreateChallenge();
        var payload = AltchaTestHelper.Solve(foreign);

        Assert.Equal(AltchaVerificationResult.InvalidSolution, Create().Verify(payload));
    }

    [Fact]
    public void Verify_SelfMadeChallengeWithoutTheKey_IsInvalidSolution()
    {
        // An attacker builds a challenge with his own salt (even with a far expiry) and solves it: the signature cannot be forged
        var service = Create();
        var salt = "00112233445566778899aabb?expires=9999999999&";
        var challenge = Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(salt + 7)));
        var forged = new AltchaChallenge("SHA-256", challenge, salt, new string('0', 64), 1000);

        Assert.Equal(AltchaVerificationResult.InvalidSolution, service.Verify(AltchaTestHelper.Encode(forged, 7)));
    }

    [Fact]
    public void Verify_ExpiredChallenge()
    {
        var time = new FakeTime(Start);
        var service = Create(time, validityMinutes: 10);
        var payload = AltchaTestHelper.Solve(service.CreateChallenge());

        time.Advance(TimeSpan.FromMinutes(11));

        Assert.Equal(AltchaVerificationResult.Expired, service.Verify(payload));
    }

    [Fact]
    public void Verify_StillValidJustBeforeExpiry()
    {
        var time = new FakeTime(Start);
        var service = Create(time, validityMinutes: 10);
        var payload = AltchaTestHelper.Solve(service.CreateChallenge());

        time.Advance(TimeSpan.FromMinutes(9));

        Assert.Equal(AltchaVerificationResult.Valid, service.Verify(payload));
    }

    [Theory]
    [InlineData("00112233445566778899aabb?expires=9999999999&evil=1&")]
    [InlineData("00112233445566778899aabb?expires=9999999999")]
    [InlineData("00112233445566778899aabb?expires=-1&")]
    [InlineData("00112233445566778899aabb?expires=1234567890123&")]
    [InlineData("00112233445566778899aabb&")]
    [InlineData("ZZ112233445566778899aabb?expires=9999999999&")]
    [InlineData("<script>alert(1)</script>")]
    public void Verify_SaltNotIssuedByTheServer_IsMalformed(string salt)
    {
        var forged = new AltchaChallenge("SHA-256", new string('a', 64), salt, new string('b', 64), 1000);

        Assert.Equal(AltchaVerificationResult.Malformed, Create().Verify(AltchaTestHelper.Encode(forged, 1)));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(1001)]
    [InlineData(long.MaxValue)]
    public void Verify_NumberOutOfRange_IsMalformed(long number)
    {
        var service = Create();

        Assert.Equal(AltchaVerificationResult.Malformed, service.Verify(AltchaTestHelper.Encode(service.CreateChallenge(), number)));
    }

    [Fact]
    public void Verify_OtherAlgorithm_IsMalformed()
    {
        var service = Create();
        var challenge = service.CreateChallenge() with { Algorithm = "SHA-1" };

        Assert.Equal(AltchaVerificationResult.Malformed, service.Verify(AltchaTestHelper.Encode(challenge, 1)));
    }

    [Fact]
    public async Task Verify_ConcurrentReplay_AcceptsExactlyOne()
    {
        var service = Create();
        var payload = AltchaTestHelper.Solve(service.CreateChallenge());

        var results = await Task.WhenAll(Enumerable.Range(0, 32).Select(_ => Task.Run(() => service.Verify(payload))));

        Assert.Equal(1, results.Count(r => r == AltchaVerificationResult.Valid));
        Assert.Equal(31, results.Count(r => r == AltchaVerificationResult.AlreadyUsed));
    }

    [Fact]
    public void Verify_ConsumedSolutionsAreRemovedAfterExpiry_AndStillRejected()
    {
        var time = new FakeTime(Start);
        var service = Create(time, validityMinutes: 1);
        var payload = AltchaTestHelper.Solve(service.CreateChallenge());
        Assert.Equal(AltchaVerificationResult.Valid, service.Verify(payload));

        time.Advance(TimeSpan.FromMinutes(5));
        // Another verification triggers the pruning of the expired entry; the old solution is now rejected because it has expired
        Assert.Equal(AltchaVerificationResult.Valid, service.Verify(AltchaTestHelper.Solve(service.CreateChallenge())));
        Assert.Equal(AltchaVerificationResult.Expired, service.Verify(payload));
    }

    private static long ExtractNumber(string payload)
        => System.Text.Json.JsonDocument.Parse(Convert.FromBase64String(payload)).RootElement.GetProperty("number").GetInt64();

    private sealed class FakeEnvironment(string name) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = name;
        public string ApplicationName { get; set; } = "test";
        public string ContentRootPath { get; set; } = ".";
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = null!;
    }

    private static ValidateOptionsResult Validate(string environment, AltchaOptions options)
        => new AltchaOptionsValidator(new FakeEnvironment(environment)).Validate(null, options);

    [Fact]
    public void Options_PlaceholderKeyIsAcceptedInDevelopmentAndTesting()
    {
        Assert.True(Validate("Development", new AltchaOptions()).Succeeded);
        Assert.True(Validate("Testing", new AltchaOptions()).Succeeded);
    }

    [Theory]
    [InlineData("Production")]
    [InlineData("Staging")]
    public void Options_PlaceholderKeyIsRejectedOutsideDevelopment(string environment)
    {
        var result = Validate(environment, new AltchaOptions());

        Assert.True(result.Failed);
        Assert.Contains("Altcha__HmacKey", result.FailureMessage);
    }

    [Fact]
    public void Options_EnvExamplePlaceholderIsRejectedInProduction()
        => Assert.True(Validate("Production", new AltchaOptions { HmacKey = "CHANGE-ME-generate-with-openssl-rand-hex-32" }).Failed);

    [Fact]
    public void Options_RealKeyIsAcceptedInProduction()
        => Assert.True(Validate("Production", new AltchaOptions { HmacKey = new string('k', 64) }).Succeeded);

    [Theory]
    [InlineData("")]
    [InlineData("short")]
    public void Options_MissingOrShortKeyIsRejectedEverywhere(string key)
        => Assert.True(Validate("Development", new AltchaOptions { HmacKey = key }).Failed);

    [Theory]
    [InlineData(999, 10)]
    [InlineData(10_000_001, 10)]
    [InlineData(300_000, 0)]
    [InlineData(300_000, 121)]
    public void Options_OutOfRangeDifficultyOrValidityIsRejected(int maxNumber, int minutes)
        => Assert.True(Validate("Development", new AltchaOptions { MaxNumber = maxNumber, ChallengeValidityMinutes = minutes }).Failed);
}
