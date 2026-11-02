using MailKit.Net.Smtp;
using Microsoft.Extensions.Options;
using MimeKit;
using SagreEventi.Web.Server.Models.Services.Application;
using SagreEventi.Web.Server.Options;

namespace SagreEventi.Web.Server.Models.Services.Infrastructure;

/// <summary>
/// <see cref="IEmailSender"/> that talks to the SMTP server of the <c>Smtp</c> section through MailKit.
/// The server certificate is always validated: there is no way to switch it off.
/// </summary>
public sealed class MailKitEmailSender(IOptionsMonitor<SmtpOptions> options) : IEmailSender
{
    private const int TimeoutMs = 30_000;

    /// <inheritdoc />
    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(message);
        var smtp = options.CurrentValue;
        var mime = CreaMessaggio(message, smtp);

        try
        {
            await InviaAsync(mime, smtp, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Only the exception type goes in the text: the inner exception stays attached for diagnostics
            throw new EmailSendException($"The e-mail could not be sent ({ex.GetType().Name}).", ex);
        }
    }

    private static MimeMessage CreaMessaggio(EmailMessage message, SmtpOptions smtp)
    {
        if (!TryParseIndirizzo(message.To, out var destinatario))
        {
            throw new ArgumentException("The recipient must be a single valid address without line breaks.", nameof(message));
        }

        if (message.Subject is null || message.Subject.Any(char.IsControl))
        {
            throw new ArgumentException("The subject cannot contain line breaks or control characters.", nameof(message));
        }

        var mime = new MimeMessage();
        mime.From.Add(MailboxAddress.Parse(smtp.Sender));
        mime.To.Add(destinatario);
        mime.Subject = message.Subject;
        mime.Body = new TextPart("plain") { Text = message.Body ?? string.Empty };
        return mime;
    }

    private static bool TryParseIndirizzo(string? valore, out MailboxAddress indirizzo)
    {
        indirizzo = null!;

        // A bare address only: no display name, no list, no control characters (header injection)
        if (string.IsNullOrWhiteSpace(valore)
            || valore.Any(c => char.IsControl(c) || char.IsWhiteSpace(c) || c is ',' or ';' or '<' or '>')
            || !MailboxAddress.TryParse(valore, out var parsed)
            // The parser also accepts a local name without domain ("noreply"): a real recipient needs both parts
            || parsed.Address.StartsWith('@') || parsed.Address.EndsWith('@') || !parsed.Address.Contains('@'))
        {
            return false;
        }

        indirizzo = parsed;
        return true;
    }

    private static async Task InviaAsync(MimeMessage mime, SmtpOptions smtp, CancellationToken cancellationToken)
    {
        using var client = new SmtpClient { Timeout = TimeoutMs };
        await client.ConnectAsync(smtp.Host, smtp.Port, smtp.Security, cancellationToken);

        if (!string.IsNullOrEmpty(smtp.Username))
        {
            await client.AuthenticateAsync(smtp.Username, smtp.Password ?? string.Empty, cancellationToken);
        }

        await client.SendAsync(mime, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }
}
