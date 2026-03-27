using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BikeTracking.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FixRideMilesUpperBoundNumericComparison : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Rides_Miles_GreaterThanZero",
                table: "Rides");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Rides_Miles_GreaterThanZero",
                table: "Rides",
                sql: "CAST(\"Miles\" AS REAL) > 0 AND CAST(\"Miles\" AS REAL) <= 200");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Rides_Miles_GreaterThanZero",
                table: "Rides");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Rides_Miles_GreaterThanZero",
                table: "Rides",
                sql: "\"Miles\" > 0 AND \"Miles\" <= 200");
        }
    }
}
