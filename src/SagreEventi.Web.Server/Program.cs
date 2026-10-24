using SagreEventi.Web.Server.Endpoints;
using SagreEventi.Web.Server.Extensions;

namespace SagreEventi.Web.Server;

public class Program
{
    /// <summary>Application entry point: configures the services and the HTTP pipeline, then runs the API.</summary>
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        builder.Configuration.AddJsonFile("appsettings.local.json", optional: true, reloadOnChange: true);
        builder.Services.AddApplicationServices(builder.Configuration);

        var app = builder.Build();

        // First of the pipeline: the client IP (rate limits) and the scheme (HSTS, redirection) come from the trusted proxy
        app.UseForwardedHeaders();

        // Browsers must not sniff the content type of the responses (a JSON body is never interpreted as HTML)
        app.Use(async (context, next) =>
        {
            context.Response.Headers.XContentTypeOptions = "nosniff";
            await next();
        });

        // HSTS (Strict-Transport-Security) outside Development, before the HTTPS redirection
        if (!app.Environment.IsDevelopment())
        {
            app.UseHsts();
        }

        app.UseHttpsRedirection();

        if (app.Environment.IsDevelopment())
        {
            // OpenAPI document at /openapi/v1.json
            app.MapOpenApi();
        }
        else
        {
            app.UseExceptionHandler();
        }

        // API-only backend: the frontend (Angular) is a separate application
        app.UseRouting();
        app.UseCors();
        app.UseRateLimiter();
        app.UseAuthentication();
        app.UseAuthorization();

        // Liveness probe for Docker/nginx: anonymous, no dependencies, no internal details
        app.MapHealthChecks("/healthz");

        app.MapAuthEndpoints(app.Configuration);
        app.MapEventiEndpoints();
        app.MapRevisioneEndpoints();
        app.MapAdminUtentiEndpoints();

        app.Run();
    }
}
