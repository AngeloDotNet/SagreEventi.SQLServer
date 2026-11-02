using MailKit.Security;

namespace SagreEventi.Web.Server.Options;

/// <summary>SMTP server used to send e-mails, <c>Smtp</c> section of appsettings. Real credentials come from <c>Smtp__*</c> environment variables.</summary>
public sealed class SmtpOptions
{
    /// <summary>Name of the configuration section.</summary>
    public const string SectionName = "Smtp";

    /// <summary>Host committed in appsettings.json: rejected at startup outside Development and Testing.</summary>
    public const string PlaceholderHost = "smtp.change-me.invalid";

    /// <summary>SMTP host name.</summary>
    public string Host { get; set; } = PlaceholderHost;

    /// <summary>SMTP port.</summary>
    public int Port { get; set; } = 587;

    /// <summary>Connection security. The server certificate is always validated; <see cref="SecureSocketOptions.None"/> is meant only for a local test SMTP.</summary>
    public SecureSocketOptions Security { get; set; } = SecureSocketOptions.Auto;

    /// <summary>User name; leave empty when the server needs no authentication.</summary>
    public string? Username { get; set; }

    /// <summary>Password; never log it, never commit a real value.</summary>
    public string? Password { get; set; }

    /// <summary>Sender, either a bare address or <c>Name &lt;address&gt;</c>.</summary>
    public string Sender { get; set; } = "NoReply <noreply@change-me.invalid>";
}
