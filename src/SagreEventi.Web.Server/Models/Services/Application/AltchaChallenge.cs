using System.Text.Json.Serialization;

namespace SagreEventi.Web.Server.Models.Services.Application;

/// <summary>A signed proof-of-work challenge, in the shape the ALTCHA widget expects (v1 protocol).</summary>
/// <param name="Algorithm">Hash algorithm, always <c>SHA-256</c>.</param>
/// <param name="Challenge">Hex SHA-256 of the salt followed by the secret number.</param>
/// <param name="Salt">Random salt with the expiry (<c>&lt;hex&gt;?expires=&lt;unix&gt;&amp;</c>).</param>
/// <param name="Signature">Hex HMAC-SHA256 of the challenge, computed with the server key.</param>
/// <param name="MaxNumber">Upper bound of the secret number the client has to search.</param>
public sealed record AltchaChallenge(
    string Algorithm,
    string Challenge,
    string Salt,
    string Signature,
    [property: JsonPropertyName("maxnumber")] int MaxNumber);
