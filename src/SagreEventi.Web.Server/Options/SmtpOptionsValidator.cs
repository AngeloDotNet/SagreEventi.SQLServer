using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;

namespace SagreEventi.Web.Server.Options;

/// <summary>Validates <see cref="SmtpOptions"/> at startup; the error messages name the configuration key to fix.</summary>
public sealed class SmtpOptionsValidator(IHostEnvironment environment) : IValidateOptions<SmtpOptions>
{
    /// <inheritdoc />
    public ValidateOptionsResult Validate(string? name, SmtpOptions options)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(options.Host) || options.Host.Any(char.IsWhiteSpace))
        {
            errors.Add("Smtp:Host (env Smtp__Host) is required and cannot contain spaces.");
        }
        else if (options.Host.Equals(SmtpOptions.PlaceholderHost, StringComparison.OrdinalIgnoreCase)
            && !environment.IsDevelopment() && !environment.IsEnvironment("Testing"))
        {
            errors.Add("Smtp:Host (env Smtp__Host) is still the placeholder: set the real SMTP server.");
        }

        if (options.Port is < 1 or > 65535)
        {
            errors.Add("Smtp:Port must be between 1 and 65535.");
        }

        if (!Enum.IsDefined(options.Security))
        {
            errors.Add("Smtp:Security is not a valid value (None, Auto, SslOnConnect, StartTls, StartTlsWhenAvailable).");
        }
        else if (options.Security is SecureSocketOptions.None or SecureSocketOptions.StartTlsWhenAvailable && !environment.IsDevelopment())
        {
            // None never encrypts and StartTlsWhenAvailable falls back to clear text when the server does not offer STARTTLS:
            // credentials and e-mails would travel unprotected. Both are only for a local test SMTP (Mailpit) while developing.
            errors.Add("Smtp:Security (env Smtp__Security) cannot be None or StartTlsWhenAvailable outside Development: use SslOnConnect (port 465), StartTls or Auto.");
        }

        if (string.IsNullOrEmpty(options.Username) != string.IsNullOrEmpty(options.Password))
        {
            errors.Add("Smtp:Username and Smtp:Password (env Smtp__Username, Smtp__Password) must be set together or both left empty.");
        }

        if (!SenderValido(options.Sender))
        {
            errors.Add("Smtp:Sender (env Smtp__Sender) must be a single valid address, optionally as 'Name <address>'.");
        }

        return errors.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(errors);
    }

    private static bool SenderValido(string? sender)
        => !string.IsNullOrWhiteSpace(sender)
        && sender.All(c => !char.IsControl(c))
        && MailboxAddress.TryParse(sender, out var indirizzo)
        // The parser also accepts a local name without domain ("noreply"): the sender needs both parts
        && indirizzo.Address.Contains('@') && !indirizzo.Address.StartsWith('@') && !indirizzo.Address.EndsWith('@');
}
