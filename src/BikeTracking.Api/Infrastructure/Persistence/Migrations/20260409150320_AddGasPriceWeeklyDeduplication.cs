using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BikeTracking.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGasPriceWeeklyDeduplication : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "WeekStartDate",
                table: "GasPriceLookups",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1)
            );

            // Backfill week key from existing PriceDate values.
            migrationBuilder.Sql(
                """
                UPDATE "GasPriceLookups"
                SET "WeekStartDate" = date("PriceDate", '-' || strftime('%w', "PriceDate") || ' days');
                """
            );

            // Existing cache may contain multiple rows in the same Sunday-Saturday window.
            // Keep the most recent row per week key before enforcing uniqueness.
            migrationBuilder.Sql(
                """
                DELETE FROM "GasPriceLookups"
                WHERE "GasPriceLookupId" NOT IN (
                    SELECT MAX("GasPriceLookupId")
                    FROM "GasPriceLookups"
                    GROUP BY "WeekStartDate"
                );
                """
            );

            migrationBuilder.CreateIndex(
                name: "IX_GasPriceLookups_WeekStartDate",
                table: "GasPriceLookups",
                column: "WeekStartDate",
                unique: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_GasPriceLookups_WeekStartDate",
                table: "GasPriceLookups"
            );

            migrationBuilder.DropColumn(name: "WeekStartDate", table: "GasPriceLookups");
        }
    }
}
