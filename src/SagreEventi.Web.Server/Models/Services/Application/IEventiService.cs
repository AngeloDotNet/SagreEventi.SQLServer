using SagreEventi.Shared.Models;

namespace SagreEventi.Web.Server.Models.Services.Application;

public interface IEventiService
{
    Task<List<EventoModel>> GetEventiAsync(DateTime since, CancellationToken cancellationToken = default);
    Task<List<EventoModel>> GetEventiScadutiAsync(DateTime dataOdierna, CancellationToken cancellationToken = default);
    Task UpdateEventoAsync(EventoModel evento, CancellationToken cancellationToken = default);
    Task UpdateEventiAsync(List<EventoModel> eventi, CancellationToken cancellationToken = default);
}