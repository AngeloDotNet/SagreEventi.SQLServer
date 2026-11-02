# API image. Build context: the repository root, e.g.
#   docker build -f src/SagreEventi.Web.Server/Dockerfile -t sagreeventi-api .
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first (cached while the project files do not change)
COPY Directory.Build.props Directory.Packages.props ./
COPY src/SagreEventi.Shared/SagreEventi.Shared.csproj src/SagreEventi.Shared/packages.lock.json src/SagreEventi.Shared/
COPY src/SagreEventi.Web.Server/SagreEventi.Web.Server.csproj src/SagreEventi.Web.Server/packages.lock.json src/SagreEventi.Web.Server/
RUN dotnet restore --locked-mode src/SagreEventi.Web.Server/SagreEventi.Web.Server.csproj

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

ENTRYPOINT ["dotnet", "SagreEventi.Web.Server.dll"]
