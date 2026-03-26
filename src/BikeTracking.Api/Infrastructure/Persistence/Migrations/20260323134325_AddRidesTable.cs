using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BikeTracking.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRidesTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Rides",
                columns: table => new
                {
                    Id = table
                        .Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    RiderId = table.Column<long>(type: "INTEGER", nullable: false),
                    RideDateTimeLocal = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Miles = table.Column<decimal>(type: "TEXT", nullable: false),
                    RideMinutes = table.Column<int>(type: "INTEGER", nullable: true),
                    Temperature = table.Column<decimal>(type: "TEXT", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Rides", x => x.Id);
                    table.CheckConstraint("CK_Rides_Miles_GreaterThanZero", "\"Miles\" > 0");
                    table.CheckConstraint(
                        "CK_Rides_RideMinutes_GreaterThanZero",
                        "\"RideMinutes\" IS NULL OR \"RideMinutes\" > 0"
                    );
                    table.ForeignKey(
                        name: "FK_Rides_Users_RiderId",
                        column: x => x.RiderId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateIndex(
                name: "IX_Rides_RiderId_CreatedAtUtc_Desc",
                table: "Rides",
                columns: new[] { "RiderId", "CreatedAtUtc" },
                descending: new[] { false, true }
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "Rides");
        }
    }
}
