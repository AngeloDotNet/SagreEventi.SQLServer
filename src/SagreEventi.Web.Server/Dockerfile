# API image. Build context: the repository root, e.g.
#   docker build -f src/SagreEventi.Web.Server/Dockerfile -t sagreeventi-api .
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first (cached while the project files do not change)
COPY Directory.Build.props ./
COPY src/SagreEventi.Shared/SagreEventi.Shared.csproj src/SagreEventi.Shared/
COPY src/SagreEventi.Web.Server/SagreEventi.Web.Server.csproj src/SagreEventi.Web.Server/
RUN dotnet restore src/SagreEventi.Web.Server/SagreEventi.Web.Server.csproj

COPY src/SagreEventi.Shared/ src/SagreEventi.Shared/
COPY src/SagreEventi.Web.Server/ src/SagreEventi.Web.Server/
RUN dotnet publish src/SagreEventi.Web.Server/SagreEventi.Web.Server.csproj -c Release --no-restore -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

# Plain HTTP inside the Docker network: nginx terminates HTTPS and is the only entry point (the port is not published)
ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

# Not root (the "app" user is predefined in the Microsoft images)
USER app

# The image has no curl/wget: the probe talks to /healthz with bash alone
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=3 \
    CMD ["bash", "-c", "exec 3<>/dev/tcp/127.0.0.1/8080 && printf 'GET /healthz HTTP/1.0\r\nHost: localhost\r\n\r\n' >&3 && head -n 1 <&3 | grep -q ' 200 '"]

ENTRYPOINT ["dotnet", "SagreEventi.Web.Server.dll"]
