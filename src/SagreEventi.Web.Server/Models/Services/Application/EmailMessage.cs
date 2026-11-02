namespace SagreEventi.Web.Server.Models.Services.Application;

/// <summary>A plain-text e-mail to a single recipient. All the values are validated by the sender before they reach the SMTP server.</summary>
/// <param name="To">Recipient address (a single bare address; no line breaks).</param>
/// <param name="Subject">Subject line (no line breaks).</param>
/// <param name="Body">Plain-text body.</param>
public sealed record EmailMessage(string To, string Subject, string Body);
