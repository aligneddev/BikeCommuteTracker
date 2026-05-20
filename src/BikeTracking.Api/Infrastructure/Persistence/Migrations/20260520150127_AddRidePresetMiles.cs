using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BikeTracking.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRidePresetMiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Miles",
                table: "RidePresets",
                type: "TEXT",
                precision: 10,
                scale: 2,
                nullable: false,
                defaultValue: 1m
            );

            migrationBuilder.AddCheckConstraint(
                name: "CK_RidePresets_Miles_Positive",
                table: "RidePresets",
                sql: "CAST(\"Miles\" AS REAL) > 0 AND CAST(\"Miles\" AS REAL) <= 200"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_RidePresets_Miles_Positive",
                table: "RidePresets"
            );

            migrationBuilder.DropColumn(name: "Miles", table: "RidePresets");
        }
    }
}
