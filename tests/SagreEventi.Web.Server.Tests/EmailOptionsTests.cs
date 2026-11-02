using MailKit.Security;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using SagreEventi.Web.Server.Options;

namespace SagreEventi.Web.Server.Tests;

/// <summary>Startup validation of the e-mail related options: SMTP, moderation notice interval and public address.</summary>
public class EmailOptionsTests
{
    private sealed class AmbienteFinto(string name) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = name;
        public string ApplicationName { get; set; } = "Test";
        public string ContentRootPath { get; set; } = "/";
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    private static SmtpOptions SmtpValide() => new()
    {
        Host = "smtp.example.org",
        Port = 587,
        Security = SecureSocketOptions.StartTls,
        Username = "utente",
        Password = "password",
        Sender = "Sagre <noreply@example.org>",
    };

    private static ValidateOptionsResult ValidaSmtp(SmtpOptions options, string ambiente = "Production")
        => new SmtpOptionsValidator(new AmbienteFinto(ambiente)).Validate(null, options);

    private static ValidateOptionsResult ValidaApp(string url, string ambiente = "Production")
        => new AppOptionsValidator(new AmbienteFinto(ambiente)).Validate(null, new AppOptions { PublicBaseUrl = url });

    // ---- Smtp

    [Fact]
    public void Smtp_ValidConfigurationIsAccepted() => Assert.True(ValidaSmtp(SmtpValide()).Succeeded);

    [Fact]
    public void Smtp_AuthenticationCanBeLeftOutEntirely()
    {
        var options = SmtpValide();
        options.Username = null;
        options.Password = "";

        Assert.True(ValidaSmtp(options).Succeeded);
    }

    [Theory]
    [InlineData("Production")]
    [InlineData("Staging")]
    public void Smtp_PlaceholderHostIsRejectedOutsideDevelopmentAndTesting(string ambiente)
    {
        var options = SmtpValide();
        options.Host = SmtpOptions.PlaceholderHost;

        var result = ValidaSmtp(options, ambiente);

        Assert.True(result.Failed);
        Assert.Contains("Smtp__Host", result.FailureMessage);
    }

    [Theory]
    [InlineData("Development")]
    [InlineData("Testing")]
    public void Smtp_PlaceholderHostIsAcceptedInDevelopmentAndTesting(string ambiente)
    {
        var options = SmtpValide();
        options.Host = SmtpOptions.PlaceholderHost;

        Assert.True(ValidaSmtp(options, ambiente).Succeeded);
    }

    [Theory]
    [InlineData("")]
    [InlineData("  ")]
    [InlineData("smtp example.org")]
    [InlineData("smtp.example.org\r\nBcc: x@y.it")]
    public void Smtp_EmptyOrMalformedHostIsRejected(string host)
    {
        var options = SmtpValide();
        options.Host = host;

        Assert.True(ValidaSmtp(options).Failed);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(65536)]
    public void Smtp_PortOutOfRangeIsRejected(int porta)
    {
        var options = SmtpValide();
        options.Port = porta;

        Assert.True(ValidaSmtp(options).Failed);
    }

    [Fact]
    public void Smtp_UnknownSecurityValueIsRejected()
    {
        var options = SmtpValide();
        options.Security = (SecureSocketOptions)99;

        Assert.True(ValidaSmtp(options).Failed);
    }

    [Theory]
    [InlineData("Production", SecureSocketOptions.None)]
    [InlineData("Staging", SecureSocketOptions.None)]
    [InlineData("Testing", SecureSocketOptions.None)]
    [InlineData("Production", SecureSocketOptions.StartTlsWhenAvailable)]
    [InlineData("Staging", SecureSocketOptions.StartTlsWhenAvailable)]
    [InlineData("Testing", SecureSocketOptions.StartTlsWhenAvailable)]
    public void Smtp_ModesThatMayStayInClearTextAreRejectedOutsideDevelopment(string ambiente, SecureSocketOptions sicurezza)
    {
        var options = SmtpValide();
        options.Security = sicurezza;

        var result = ValidaSmtp(options, ambiente);

        Assert.True(result.Failed);
        Assert.Contains("Smtp__Security", result.FailureMessage);
    }

    [Theory]
    [InlineData(SecureSocketOptions.None)]
    [InlineData(SecureSocketOptions.StartTlsWhenAvailable)]
    public void Smtp_ModesThatMayStayInClearTextAreAcceptedInDevelopment(SecureSocketOptions sicurezza)
    {
        var options = SmtpValide();
        options.Security = sicurezza;

        Assert.True(ValidaSmtp(options, "Development").Succeeded);
    }

    [Theory]
    [InlineData(SecureSocketOptions.Auto)]
    [InlineData(SecureSocketOptions.SslOnConnect)]
    [InlineData(SecureSocketOptions.StartTls)]
    public void Smtp_TlsModesAreAcceptedInProduction(SecureSocketOptions sicurezza)
    {
        var options = SmtpValide();
        options.Security = sicurezza;

        Assert.True(ValidaSmtp(options).Succeeded);
    }

    [Theory]
    [InlineData("utente", null)]
    [InlineData("utente", "")]
    [InlineData(null, "password")]
    public void Smtp_UserAndPasswordMustComeTogether(string? utente, string? password)
    {
        var options = SmtpValide();
        options.Username = utente;
        options.Password = password;

        Assert.True(ValidaSmtp(options).Failed);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("non un indirizzo")]
    [InlineData("noreply")]
    [InlineData("@example.org")]
    [InlineData("noreply@")]
    [InlineData("noreply@example.org\r\nBcc: x@y.it")]
    [InlineData("Sagre <noreply@example.org>, altro@example.org")]
    public void Smtp_InvalidSenderIsRejected(string? mittente)
    {
        var options = SmtpValide();
        options.Sender = mittente!;

        var result = ValidaSmtp(options);

        Assert.True(result.Failed);
        Assert.Contains("Smtp__Sender", result.FailureMessage);
    }

    // ---- Moderazione

    [Theory]
    [InlineData(5)]
    [InlineData(60)]
    [InlineData(1440)]
    public void Moderazione_IntervalAtOrAboveTheMinimumIsAccepted(int minuti)
        => Assert.True(new ModerazioneOptionsValidator().Validate(null, new ModerazioneOptions { AvvisoIntervalloMinuti = minuti }).Succeeded);

    [Theory]
    [InlineData(4)]
    [InlineData(0)]
    [InlineData(-60)]
    public void Moderazione_IntervalBelowTheMinimumIsRejected(int minuti)
    {
        var result = new ModerazioneOptionsValidator().Validate(null, new ModerazioneOptions { AvvisoIntervalloMinuti = minuti });

        Assert.True(result.Failed);
        Assert.Contains("Moderazione__AvvisoIntervalloMinuti", result.FailureMessage);
    }

    [Fact]
    public void Moderazione_DefaultIsSixtyMinutes() => Assert.Equal(TimeSpan.FromHours(1), new ModerazioneOptions().Intervallo);

    // ---- App:PublicBaseUrl

    [Theory]
    [InlineData("https://sagre.example.org")]
    [InlineData("https://sagre.example.org/")]
    [InlineData("https://sagre.example.org/app")]
    [InlineData("https://sagre.example.org:8443")]
    public void App_HttpsAddressIsAccepted(string url) => Assert.True(ValidaApp(url).Succeeded);

    [Theory]
    [InlineData("http://sagre.example.org")]
    [InlineData("ftp://sagre.example.org")]
    [InlineData("javascript:alert(1)")]
    [InlineData("//sagre.example.org")]
    [InlineData("/gestione")]
    [InlineData("sagre.example.org")]
    [InlineData("")]
    [InlineData("https://utente:segreto@sagre.example.org")]
    [InlineData("https://sagre.example.org/?a=1")]
    [InlineData("https://sagre.example.org/#x")]
    [InlineData("https://sagre.example.org\r\nBcc: attaccante@example.org")]
    [InlineData("https://sagre.example.org/app\nAltro")]
    [InlineData(" https://sagre.example.org")]
    public void App_NonHttpsRelativeOrDecoratedAddressIsRejected(string url)
    {
        var result = ValidaApp(url);

        Assert.True(result.Failed);
        Assert.Contains("App__PublicBaseUrl", result.FailureMessage);
    }

    [Fact]
    public void App_HttpIsAcceptedOnlyInDevelopmentAndTesting()
    {
        Assert.True(ValidaApp("http://localhost:4200", "Development").Succeeded);
        Assert.True(ValidaApp("http://localhost:4200", "Testing").Succeeded);
        Assert.True(ValidaApp("http://localhost:4200", "Production").Failed);
    }

    [Fact]
    public void App_PlaceholderIsRejectedOutsideDevelopmentAndTesting()
    {
        Assert.True(ValidaApp(AppOptions.PlaceholderBaseUrl, "Production").Failed);
        Assert.True(ValidaApp(AppOptions.PlaceholderBaseUrl, "Development").Succeeded);
        Assert.True(ValidaApp(AppOptions.PlaceholderBaseUrl, "Testing").Succeeded);
    }
}
