using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BikeTracking.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMonthlySummaryImport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ImportSource",
                table: "Rides",
                type: "TEXT",
                maxLength: 64,
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "ImportSource",
                table: "ImportRows",
                type: "TEXT",
                maxLength: 64,
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "ImportType",
                table: "ImportJobs",
                type: "TEXT",
                maxLength: 32,
                nullable: false,
                defaultValue: "csv"
            );

            migrationBuilder.CreateTable(
                name: "MonthlySummaryAuditLogs",
                columns: table => new
                {
                    Id = table
                        .Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    RiderId = table.Column<long>(type: "INTEGER", nullable: false),
                    ImportJobId = table.Column<long>(type: "INTEGER", nullable: false),
                    TimestampUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    StartYear = table.Column<int>(type: "INTEGER", nullable: false),
                    EndYear = table.Column<int>(type: "INTEGER", nullable: false),
                    MonthsParsed = table.Column<int>(type: "INTEGER", nullable: false),
                    RidesCreated = table.Column<int>(type: "INTEGER", nullable: false),
                    RidesReplaced = table.Column<int>(type: "INTEGER", nullable: false),
                    RidesSkipped = table.Column<int>(type: "INTEGER", nullable: false),
                    RowsRejected = table.Column<int>(type: "INTEGER", nullable: false),
                    ValidationErrorsSummaryJson = table.Column<string>(
                        type: "TEXT",
                        nullable: true
                    ),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MonthlySummaryAuditLogs", x => x.Id);
                }
            );

            migrationBuilder.CreateIndex(
                name: "IX_MonthlySummaryAuditLogs_ImportJobId",
                table: "MonthlySummaryAuditLogs",
                column: "ImportJobId",
                unique: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "MonthlySummaryAuditLogs");

            migrationBuilder.DropColumn(name: "ImportSource", table: "Rides");

            migrationBuilder.DropColumn(name: "ImportSource", table: "ImportRows");

            migrationBuilder.DropColumn(name: "ImportType", table: "ImportJobs");
        }
    }
}
