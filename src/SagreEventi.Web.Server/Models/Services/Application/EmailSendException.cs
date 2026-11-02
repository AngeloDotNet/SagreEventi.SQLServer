namespace SagreEventi.Web.Server.Models.Services.Application;

/// <summary>The message could not be delivered to the mail server. The message text never contains credentials or the body of the e-mail.</summary>
public sealed class EmailSendException(string message, Exception innerException) : Exception(message, innerException);
