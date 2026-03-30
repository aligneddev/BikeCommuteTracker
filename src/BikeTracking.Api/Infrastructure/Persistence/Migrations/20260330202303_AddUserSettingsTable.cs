using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BikeTracking.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUserSettingsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserSettings",
                columns: table => new
                {
                    UserId = table.Column<long>(type: "INTEGER", nullable: false),
                    AverageCarMpg = table.Column<decimal>(type: "TEXT", nullable: true),
                    YearlyGoalMiles = table.Column<decimal>(type: "TEXT", nullable: true),
                    OilChangePrice = table.Column<decimal>(type: "TEXT", nullable: true),
                    MileageRateCents = table.Column<decimal>(type: "TEXT", nullable: true),
                    LocationLabel = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    Latitude = table.Column<decimal>(type: "TEXT", nullable: true),
                    Longitude = table.Column<decimal>(type: "TEXT", nullable: true),
                    UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserSettings", x => x.UserId);
                    table.CheckConstraint("CK_UserSettings_AverageCarMpg_Positive", "\"AverageCarMpg\" IS NULL OR CAST(\"AverageCarMpg\" AS REAL) > 0");
                    table.CheckConstraint("CK_UserSettings_Latitude_Range", "\"Latitude\" IS NULL OR (CAST(\"Latitude\" AS REAL) >= -90 AND CAST(\"Latitude\" AS REAL) <= 90)");
                    table.CheckConstraint("CK_UserSettings_Longitude_Range", "\"Longitude\" IS NULL OR (CAST(\"Longitude\" AS REAL) >= -180 AND CAST(\"Longitude\" AS REAL) <= 180)");
                    table.CheckConstraint("CK_UserSettings_MileageRateCents_Positive", "\"MileageRateCents\" IS NULL OR CAST(\"MileageRateCents\" AS REAL) > 0");
                    table.CheckConstraint("CK_UserSettings_OilChangePrice_Positive", "\"OilChangePrice\" IS NULL OR CAST(\"OilChangePrice\" AS REAL) > 0");
                    table.CheckConstraint("CK_UserSettings_YearlyGoalMiles_Positive", "\"YearlyGoalMiles\" IS NULL OR CAST(\"YearlyGoalMiles\" AS REAL) > 0");
                    table.ForeignKey(
                        name: "FK_UserSettings_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserSettings");
        }
    }
}
