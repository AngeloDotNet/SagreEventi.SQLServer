using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace SagreEventi.Web.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddStatiModerazione : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StatiModerazione",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false),
                    Nome = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StatiModerazione", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "StatiModerazione",
                columns: new[] { "Id", "Nome" },
                values: new object[,]
                {
                    { 0, "InAttesa" },
                    { 1, "Approvato" },
                    { 2, "Rifiutato" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Eventi_Stato",
                table: "Eventi",
                column: "Stato");

            migrationBuilder.AddForeignKey(
                name: "FK_Eventi_StatiModerazione_Stato",
                table: "Eventi",
                column: "Stato",
                principalTable: "StatiModerazione",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Eventi_StatiModerazione_Stato",
                table: "Eventi");

            migrationBuilder.DropTable(
                name: "StatiModerazione");

            migrationBuilder.DropIndex(
                name: "IX_Eventi_Stato",
                table: "Eventi");
        }
    }
}
