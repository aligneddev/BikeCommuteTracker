using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BikeTracking.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDashboardSnapshotsAndPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "DashboardGallonsAvoidedEnabled",
                table: "UserSettings",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "DashboardGoalProgressEnabled",
                table: "UserSettings",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "SnapshotAverageCarMpg",
                table: "Rides",
                type: "TEXT",
                precision: 10,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "SnapshotMileageRateCents",
                table: "Rides",
                type: "TEXT",
                precision: 10,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "SnapshotOilChangePrice",
                table: "Rides",
                type: "TEXT",
                precision: 10,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "SnapshotYearlyGoalMiles",
                table: "Rides",
                type: "TEXT",
                precision: 10,
                scale: 4,
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Rides_SnapshotAverageCarMpg_Positive",
                table: "Rides",
                sql: "\"SnapshotAverageCarMpg\" IS NULL OR CAST(\"SnapshotAverageCarMpg\" AS REAL) > 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Rides_SnapshotMileageRateCents_Positive",
                table: "Rides",
                sql: "\"SnapshotMileageRateCents\" IS NULL OR CAST(\"SnapshotMileageRateCents\" AS REAL) > 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Rides_SnapshotOilChangePrice_Positive",
                table: "Rides",
                sql: "\"SnapshotOilChangePrice\" IS NULL OR CAST(\"SnapshotOilChangePrice\" AS REAL) > 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Rides_SnapshotYearlyGoalMiles_Positive",
                table: "Rides",
                sql: "\"SnapshotYearlyGoalMiles\" IS NULL OR CAST(\"SnapshotYearlyGoalMiles\" AS REAL) > 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Rides_SnapshotAverageCarMpg_Positive",
                table: "Rides");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Rides_SnapshotMileageRateCents_Positive",
                table: "Rides");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Rides_SnapshotOilChangePrice_Positive",
                table: "Rides");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Rides_SnapshotYearlyGoalMiles_Positive",
                table: "Rides");

            migrationBuilder.DropColumn(
                name: "DashboardGallonsAvoidedEnabled",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "DashboardGoalProgressEnabled",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "SnapshotAverageCarMpg",
                table: "Rides");

            migrationBuilder.DropColumn(
                name: "SnapshotMileageRateCents",
                table: "Rides");

            migrationBuilder.DropColumn(
                name: "SnapshotOilChangePrice",
                table: "Rides");

            migrationBuilder.DropColumn(
                name: "SnapshotYearlyGoalMiles",
                table: "Rides");
        }
    }
}
