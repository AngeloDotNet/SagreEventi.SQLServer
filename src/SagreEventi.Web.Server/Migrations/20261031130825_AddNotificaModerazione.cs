using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SagreEventi.Web.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificaModerazione : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "NotificataIl",
                table: "Eventi",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NotificataIl",
                table: "Eventi");
        }
    }
}
