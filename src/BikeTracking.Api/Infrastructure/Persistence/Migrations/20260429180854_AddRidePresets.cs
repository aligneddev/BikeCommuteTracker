using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BikeTracking.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRidePresets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RidePresets",
                columns: table => new
                {
                    RidePresetId = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    RiderId = table.Column<long>(type: "INTEGER", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 80, nullable: false),
                    PrimaryDirection = table.Column<string>(type: "TEXT", maxLength: 5, nullable: false),
                    PeriodTag = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    ExactStartTimeLocal = table.Column<TimeOnly>(type: "TEXT", nullable: false),
                    DurationMinutes = table.Column<int>(type: "INTEGER", nullable: false),
                    LastUsedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Version = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 1)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RidePresets", x => x.RidePresetId);
                    table.CheckConstraint("CK_RidePresets_DurationMinutes_Positive", "\"DurationMinutes\" > 0");
                    table.CheckConstraint("CK_RidePresets_PeriodTag_Values", "\"PeriodTag\" IN ('morning', 'afternoon')");
                    table.ForeignKey(
                        name: "FK_RidePresets_Users_RiderId",
                        column: x => x.RiderId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RidePresets_RiderId_LastUsedAtUtc_UpdatedAtUtc_Desc",
                table: "RidePresets",
                columns: new[] { "RiderId", "LastUsedAtUtc", "UpdatedAtUtc" },
                descending: new[] { false, true, true });

            migrationBuilder.CreateIndex(
                name: "IX_RidePresets_RiderId_Name",
                table: "RidePresets",
                columns: new[] { "RiderId", "Name" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RidePresets");
        }
    }
}
