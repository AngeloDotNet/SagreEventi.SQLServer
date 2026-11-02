namespace SagreEventi.Web.Server.Models.Services.Application;

/// <summary>Sends e-mails. The rest of the code depends only on this interface, never on the SMTP library.</summary>
public interface IEmailSender
{
    /// <summary>Sends one message.</summary>
    /// <param name="message">The message; the recipient and the subject are rejected if they are not a single valid address or contain line breaks.</param>
    /// <param name="cancellationToken">Cancels the operation.</param>
    /// <exception cref="ArgumentException">The recipient or the subject is not valid.</exception>
    /// <exception cref="EmailSendException">The SMTP server could not be reached or refused the message.</exception>
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default);
}
