using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BikeTracking.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGasPriceToRidesAndLookupCache : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "GasPricePerGallon",
                table: "Rides",
                type: "TEXT",
                precision: 10,
                scale: 4,
                nullable: true
            );

            migrationBuilder.CreateTable(
                name: "GasPriceLookups",
                columns: table => new
                {
                    GasPriceLookupId = table
                        .Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PriceDate = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    PricePerGallon = table.Column<decimal>(
                        type: "TEXT",
                        precision: 10,
                        scale: 4,
                        nullable: false
                    ),
                    DataSource = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    EiaPeriodDate = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    RetrievedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GasPriceLookups", x => x.GasPriceLookupId);
                }
            );

            migrationBuilder.CreateIndex(
                name: "IX_GasPriceLookups_PriceDate",
                table: "GasPriceLookups",
                column: "PriceDate",
                unique: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "GasPriceLookups");

            migrationBuilder.DropColumn(name: "GasPricePerGallon", table: "Rides");
        }
    }
}
