using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BikeTracking.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRideMilesUpperBound : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Rides_Miles_GreaterThanZero",
                table: "Rides"
            );

            migrationBuilder.AddCheckConstraint(
                name: "CK_Rides_Miles_GreaterThanZero",
                table: "Rides",
                sql: "\"Miles\" > 0 AND \"Miles\" <= 200"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Rides_Miles_GreaterThanZero",
                table: "Rides"
            );

            migrationBuilder.AddCheckConstraint(
                name: "CK_Rides_Miles_GreaterThanZero",
                table: "Rides",
                sql: "\"Miles\" > 0"
            );
        }
    }
}
