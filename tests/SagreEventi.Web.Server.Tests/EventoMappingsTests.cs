using SagreEventi.Shared.Models;
using SagreEventi.Web.Server.Models.Entities;
using SagreEventi.Web.Server.Models.Mapping;

namespace SagreEventi.Web.Server.Tests;

public class EventoMappingsTests
{
    private static EventoModel Dto() => new()
    {
        Id = "m-1",
        NomeEvento = "Sagra",
        CittaEvento = "Verona",
        DataInizioEvento = new DateTime(2026, 7, 1),
        DataFineEvento = new DateTime(2026, 7, 3),
        DescrizioneEvento = "Descrizione",
        DataOraUltimaModifica = new DateTime(2026, 6, 1, 10, 0, 0, DateTimeKind.Utc),
    };

    [Fact]
    public void ToEntity_PartireDaUnDtoLasciaLoStatoInAttesa()
    {
        var dto = Dto();
        dto.Stato = StatoModerazione.Approvato;
        dto.MotivoRifiuto = "inviato dal client";

        var evento = dto.ToEntity();

        Assert.Equal(StatoModerazione.InAttesa, evento.Stato);
        Assert.Null(evento.MotivoRifiuto);
    }

    [Fact]
    public void ApplyFrom_NonCopiaStatoMotivoERevisione()
    {
        var evento = new Evento { Id = "m-1", Stato = StatoModerazione.Rifiutato, MotivoRifiuto = "spam", RevisionatoDa = "ed@test.local", DataRevisione = DateTime.UtcNow };
        var dto = Dto();
        dto.Stato = StatoModerazione.Approvato;
        dto.MotivoRifiuto = null;

        evento.ApplyFrom(dto);

        Assert.Equal(StatoModerazione.Rifiutato, evento.Stato);
        Assert.Equal("spam", evento.MotivoRifiuto);
        Assert.Equal("ed@test.local", evento.RevisionatoDa);
        Assert.NotNull(evento.DataRevisione);
    }

    [Fact]
    public void ApplyFrom_NonCopiaEventoConcluso()
    {
        var evento = new Evento { Id = "m-1", EventoConcluso = false };
        var dto = Dto();
        dto.EventoConcluso = true;

        evento.ApplyFrom(dto);

        Assert.False(evento.EventoConcluso);
        Assert.False(dto.ToEntity().EventoConcluso);
    }

    [Fact]
    public void ToDto_ProiettaStatoEMotivo()
    {
        var evento = Dto().ToEntity();
        evento.Stato = StatoModerazione.Rifiutato;
        evento.MotivoRifiuto = "duplicato";

        var dto = EventoMappings.ToDto.Compile()(evento);

        Assert.Equal(StatoModerazione.Rifiutato, dto.Stato);
        Assert.Equal("duplicato", dto.MotivoRifiuto);
    }
}
