using SagreEventi.Web.Server.Models.Services.Application;

namespace SagreEventi.Web.Server.Tests;

/// <summary>
/// <see cref="IEmailSender"/> for the tests: it records the messages and never talks to a mail server.
/// A recipient listed in <see cref="Falliscono"/> makes the delivery fail, as an SMTP server that refuses the message would.
/// </summary>
public sealed class FakeEmailSender : IEmailSender
{
    private readonly List<EmailMessage> inviati = [];
    private readonly Lock sync = new();

    /// <summary>Addresses (case-insensitive) whose delivery fails with <see cref="EmailSendException"/>.</summary>
    public HashSet<string> Falliscono { get; } = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>When true every delivery fails, whoever the recipient is.</summary>
    public bool FallisceTutto { get; set; }

    /// <summary>Messages delivered so far.</summary>
    public IReadOnlyList<EmailMessage> Inviati
    {
        get
        {
            lock (sync)
            {
                return [.. inviati];
            }
        }
    }

    /// <summary>Forgets the messages and the failures.</summary>
    public void Azzera()
    {
        lock (sync)
        {
            inviati.Clear();
        }

        Falliscono.Clear();
        FallisceTutto = false;
    }

    /// <inheritdoc />
    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        if (FallisceTutto || Falliscono.Contains(message.To))
        {
            throw new EmailSendException("The e-mail could not be sent (test).", new IOException("simulated"));
        }

        lock (sync)
        {
            inviati.Add(message);
        }

        return Task.CompletedTask;
    }
}
