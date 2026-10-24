using System.ComponentModel.DataAnnotations;
using SagreEventi.Shared.Models;

namespace SagreEventi.Web.Server.Validation;

/// <summary>
/// Explicit validation of incoming DTOs: Minimal APIs do not validate on their own.
/// Uses the DataAnnotations of <c>EventoModel</c> and also requires the Id (the table key).
/// </summary>
public static class EventoValidator
{
    /// <summary>Returns the errors keyed by element index (e.g. <c>eventi[0].NomeEvento</c>); empty when everything is valid.</summary>
    public static Dictionary<string, string[]> Validate(IReadOnlyList<EventoModel> eventi)
    {
        var errori = new Dictionary<string, string[]>();

        for (var i = 0; i < eventi.Count; i++)
        {
            var evento = eventi[i];
            if (evento is null)
            {
                errori[$"eventi[{i}]"] = ["L'evento non può essere nullo."];
                continue;
            }

            var risultati = new List<ValidationResult>();
            Validator.TryValidateObject(evento, new ValidationContext(evento), risultati, validateAllProperties: true);

            if (string.IsNullOrWhiteSpace(evento.Id))
            {
                risultati.Add(new ValidationResult("L'id dell'evento è obbligatorio.", [nameof(EventoModel.Id)]));
            }

            foreach (var gruppo in risultati.SelectMany(r => r.MemberNames.DefaultIfEmpty(string.Empty), (r, membro) => (membro, r.ErrorMessage))
                         .GroupBy(x => x.membro))
            {
                var chiave = string.IsNullOrEmpty(gruppo.Key) ? $"eventi[{i}]" : $"eventi[{i}].{gruppo.Key}";
                errori[chiave] = gruppo.Select(x => x.ErrorMessage ?? "Valore non valido.").ToArray();
            }
        }

        return errori;
    }
}
