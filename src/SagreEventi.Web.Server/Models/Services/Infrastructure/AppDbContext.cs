using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using SagreEventi.Web.Server.Models.Identity;
using SagreEventi.Web.Server.Models.Entities;

namespace SagreEventi.Web.Server.Models.Services.Infrastructure;

/// <summary>Application database context: events plus the ASP.NET Core Identity tables.</summary>
public class AppDbContext(DbContextOptions<AppDbContext> options) : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<Evento> Eventi { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Evento>(entity =>
        {
            entity.ToTable("Eventi");
            entity.HasKey(evento => evento.Id);
            entity.Property(evento => evento.NomeEvento).IsRequired();
            entity.Property(evento => evento.CittaEvento).IsRequired();
            entity.Property(evento => evento.DescrizioneEvento).IsRequired();
            entity.Property(evento => evento.MotivoRifiuto).HasMaxLength(500);
            entity.Property(evento => evento.RevisionatoDa).HasMaxLength(256);
        });
    }
}