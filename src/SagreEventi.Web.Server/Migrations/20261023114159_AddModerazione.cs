using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SagreEventi.Web.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddModerazione : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DataRevisione",
                table: "Eventi",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MotivoRifiuto",
                table: "Eventi",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RevisionatoDa",
                table: "Eventi",
                type: "nvarchar(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Stato",
                table: "Eventi",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DataRevisione",
                table: "Eventi");

            migrationBuilder.DropColumn(
                name: "MotivoRifiuto",
                table: "Eventi");

            migrationBuilder.DropColumn(
                name: "RevisionatoDa",
                table: "Eventi");

            migrationBuilder.DropColumn(
                name: "Stato",
                table: "Eventi");
        }
    }
}
