using System.Net;
using System.Net.Sockets;
using MailKit.Security;
using Microsoft.Extensions.Options;
using SagreEventi.Web.Server.Models.Services.Application;
using SagreEventi.Web.Server.Models.Services.Infrastructure;
using SagreEventi.Web.Server.Options;

namespace SagreEventi.Web.Server.Tests;

/// <summary>
/// The sender validates recipient and subject before it opens any connection (header injection) and never leaks credentials.
/// No test reaches a real mail server: the connection tests use a local port nobody listens on.
/// </summary>
public class MailKitEmailSenderTests
{
    private const string PasswordSegreta = "password-segretissima-9f3";

    private sealed class MonitorFisso<T>(T value) : IOptionsMonitor<T>
    {
        public T CurrentValue { get; } = value;
        public T Get(string? name) => CurrentValue;
        public IDisposable? OnChange(Action<T, string?> listener) => null;
    }

    private static MailKitEmailSender Crea(int porta = 25)
        => new(new MonitorFisso<SmtpOptions>(new SmtpOptions
        {
            Host = "127.0.0.1",
            Port = porta,
            Security = SecureSocketOptions.None,
            Username = "utente",
            Password = PasswordSegreta,
            Sender = "Sagre <noreply@example.org>",
        }));

    /// <summary>A loopback port that is free right now, so a connection to it is refused at once.</summary>
    private static int PortaChiusa()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var porta = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        return porta;
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("non-un-indirizzo")]
    [InlineData("a@b.it\r\nBcc: attaccante@example.org")]
    [InlineData("a@b.it\nBcc: attaccante@example.org")]
    [InlineData("a@b.it,c@d.it")]
    [InlineData("a@b.it;c@d.it")]
    [InlineData("Nome Cognome <a@b.it>")]
    [InlineData("a@b.it c@d.it")]
    [InlineData("a@b.it\0")]
    public async Task Send_RecipientThatIsNotASingleBareAddressIsRejectedBeforeAnyConnection(string destinatario)
    {
        var sender = Crea(PortaChiusa());

        // ArgumentException, not EmailSendException: the message was refused before trying to reach the server
        await Assert.ThrowsAnyAsync<ArgumentException>(() => sender.SendAsync(new EmailMessage(destinatario, "Oggetto", "Corpo")));
    }

    [Fact]
    public async Task Send_NullRecipientIsRejected()
    {
        var sender = Crea(PortaChiusa());

        await Assert.ThrowsAnyAsync<ArgumentException>(() => sender.SendAsync(new EmailMessage(null!, "Oggetto", "Corpo")));
    }

    [Theory]
    [InlineData("Ciao\r\nBcc: attaccante@example.org")]
    [InlineData("Ciao\nBcc: attaccante@example.org")]
    [InlineData("Ciao\rBcc: attaccante@example.org")]
    [InlineData("Ciao\0")]
    [InlineData("Ciao\tBcc")]
    public async Task Send_SubjectWithLineBreaksOrControlCharactersIsRejected(string oggetto)
    {
        var sender = Crea(PortaChiusa());

        await Assert.ThrowsAnyAsync<ArgumentException>(() => sender.SendAsync(new EmailMessage("a@b.it", oggetto, "Corpo")));
    }

    [Fact]
    public async Task Send_NullMessageIsRejected()
    {
        await Assert.ThrowsAsync<ArgumentNullException>(() => Crea().SendAsync(null!));
    }

    [Fact]
    public async Task Send_UnreachableServerBecomesEmailSendExceptionWithoutLeakingCredentialsOrContent()
    {
        var sender = Crea(PortaChiusa());

        var ex = await Assert.ThrowsAsync<EmailSendException>(
            () => sender.SendAsync(new EmailMessage("destinatario@example.org", "Oggetto riservato", "Corpo riservato")));

        Assert.DoesNotContain(PasswordSegreta, ex.Message);
        Assert.DoesNotContain("destinatario@example.org", ex.Message);
        Assert.DoesNotContain("Corpo riservato", ex.Message);
        Assert.NotNull(ex.InnerException);
    }

    [Fact]
    public async Task Send_CancelledTokenPropagatesCancellationInsteadOfEmailSendException()
    {
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => Crea(PortaChiusa()).SendAsync(new EmailMessage("a@b.it", "Oggetto", "Corpo"), cts.Token));
    }
}
