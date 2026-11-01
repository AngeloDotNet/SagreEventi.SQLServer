namespace SagreEventi.Web.Server.Models.Services.Application;

/// <summary>Outcome of the verification of a proof-of-work solution.</summary>
public enum AltchaVerificationResult
{
    /// <summary>The solution is valid and has now been consumed.</summary>
    Valid,

    /// <summary>No solution was sent.</summary>
    Missing,

    /// <summary>The payload is not a well-formed solution (size, encoding, JSON, fields).</summary>
    Malformed,

    /// <summary>The challenge has expired.</summary>
    Expired,

    /// <summary>The signature or the solved number does not match: forged, altered or wrong solution.</summary>
    InvalidSolution,

    /// <summary>The same solution was already used (replay).</summary>
    AlreadyUsed,
}
