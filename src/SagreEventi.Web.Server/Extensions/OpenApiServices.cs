using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace SagreEventi.Web.Server.Extensions;

public static class OpenApiServices
{
    public const string BearerScheme = "Bearer";

    /// <summary>Registers the OpenAPI document (<c>v1</c>) with API info and the Bearer security scheme.</summary>
    public static IServiceCollection AddOpenApiServices(this IServiceCollection services)
    {
        services.AddOpenApi("v1", options =>
        {
            options.AddDocumentTransformer((document, _, _) =>
            {
                document.Info = new OpenApiInfo
                {
                    Title = "Sagre ed Eventi",
                    Version = "v1",
                    Description = "Application API that keeps track of parties and food and wine events reported by users",
                    Contact = new OpenApiContact
                    {
                        Name = "Angelo Pirola",
                        Email = "angelo@aepserver.it",
                        Url = new Uri("https://about.me/AngeloPirola"),
                    },
                    License = new OpenApiLicense
                    {
                        Name = "Licenza MIT",
                        Url = new Uri("https://it.wikipedia.org/wiki/Licenza_MIT"),
                    }
                };

                // Bearer scheme: the protected endpoints (steps 4-5) will use the Identity token
                document.Components ??= new OpenApiComponents();
                document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
                document.Components.SecuritySchemes[BearerScheme] = new OpenApiSecurityScheme
                {
                    Type = SecuritySchemeType.Http,
                    Scheme = "bearer",
                    Description = "Token ottenuto da POST /api/auth/login, inviato come 'Authorization: Bearer <token>'.",
                };

                return Task.CompletedTask;
            });
        });

        return services;
    }
}
