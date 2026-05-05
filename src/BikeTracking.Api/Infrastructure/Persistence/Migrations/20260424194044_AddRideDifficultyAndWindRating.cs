using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BikeTracking.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRideDifficultyAndWindRating : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Difficulty",
                table: "Rides",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PrimaryTravelDirection",
                table: "Rides",
                type: "TEXT",
                maxLength: 5,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "WindResistanceRating",
                table: "Rides",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Rides_Difficulty",
                table: "Rides",
                sql: "Difficulty IS NULL OR (Difficulty >= 1 AND Difficulty <= 5)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Rides_WindResistanceRating",
                table: "Rides",
                sql: "WindResistanceRating IS NULL OR (WindResistanceRating >= -4 AND WindResistanceRating <= 4)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Rides_Difficulty",
                table: "Rides");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Rides_WindResistanceRating",
                table: "Rides");

            migrationBuilder.DropColumn(
                name: "Difficulty",
                table: "Rides");

            migrationBuilder.DropColumn(
                name: "PrimaryTravelDirection",
                table: "Rides");

            migrationBuilder.DropColumn(
                name: "WindResistanceRating",
                table: "Rides");
        }
    }
}
