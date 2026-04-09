using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BikeTracking.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCsvRideImport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ImportJobs",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    RiderId = table.Column<long>(type: "INTEGER", nullable: false),
                    FileName = table.Column<string>(type: "TEXT", maxLength: 255, nullable: false),
                    TotalRows = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 0),
                    ProcessedRows = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 0),
                    ImportedRows = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 0),
                    SkippedRows = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 0),
                    FailedRows = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 0),
                    Status = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    OverrideAllDuplicates = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false),
                    EtaMinutesRounded = table.Column<int>(type: "INTEGER", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    StartedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    CompletedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    LastError = table.Column<string>(type: "TEXT", maxLength: 2048, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImportJobs", x => x.Id);
                    table.CheckConstraint("CK_ImportJobs_FailedRows_NonNegative", "\"FailedRows\" >= 0");
                    table.CheckConstraint("CK_ImportJobs_ImportedRows_NonNegative", "\"ImportedRows\" >= 0");
                    table.CheckConstraint("CK_ImportJobs_ProcessedRows_Lte_TotalRows", "\"ProcessedRows\" <= \"TotalRows\"");
                    table.CheckConstraint("CK_ImportJobs_ProcessedRows_NonNegative", "\"ProcessedRows\" >= 0");
                    table.CheckConstraint("CK_ImportJobs_SkippedRows_NonNegative", "\"SkippedRows\" >= 0");
                    table.CheckConstraint("CK_ImportJobs_TotalRows_NonNegative", "\"TotalRows\" >= 0");
                    table.ForeignKey(
                        name: "FK_ImportJobs_Users_RiderId",
                        column: x => x.RiderId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ImportRows",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ImportJobId = table.Column<long>(type: "INTEGER", nullable: false),
                    RowNumber = table.Column<int>(type: "INTEGER", nullable: false),
                    RideDateLocal = table.Column<DateOnly>(type: "TEXT", nullable: true),
                    Miles = table.Column<decimal>(type: "TEXT", precision: 10, scale: 4, nullable: true),
                    RideMinutes = table.Column<int>(type: "INTEGER", nullable: true),
                    Temperature = table.Column<decimal>(type: "TEXT", precision: 10, scale: 4, nullable: true),
                    TagsRaw = table.Column<string>(type: "TEXT", maxLength: 512, nullable: true),
                    Notes = table.Column<string>(type: "TEXT", maxLength: 2000, nullable: true),
                    ValidationStatus = table.Column<string>(type: "TEXT", maxLength: 30, nullable: false),
                    ValidationErrorsJson = table.Column<string>(type: "TEXT", nullable: true),
                    DuplicateStatus = table.Column<string>(type: "TEXT", maxLength: 30, nullable: false),
                    DuplicateResolution = table.Column<string>(type: "TEXT", maxLength: 30, nullable: true),
                    ProcessingStatus = table.Column<string>(type: "TEXT", maxLength: 30, nullable: false),
                    ExistingRideIdsJson = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedRideId = table.Column<long>(type: "INTEGER", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImportRows", x => x.Id);
                    table.CheckConstraint("CK_ImportRows_Miles_Range", "\"Miles\" IS NULL OR (CAST(\"Miles\" AS REAL) > 0 AND CAST(\"Miles\" AS REAL) <= 200)");
                    table.CheckConstraint("CK_ImportRows_RideMinutes_Positive", "\"RideMinutes\" IS NULL OR \"RideMinutes\" > 0");
                    table.CheckConstraint("CK_ImportRows_RowNumber_Positive", "\"RowNumber\" > 0");
                    table.ForeignKey(
                        name: "FK_ImportRows_ImportJobs_ImportJobId",
                        column: x => x.ImportJobId,
                        principalTable: "ImportJobs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ImportJobs_RiderId_CreatedAtUtc",
                table: "ImportJobs",
                columns: new[] { "RiderId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ImportRows_ImportJobId_RowNumber",
                table: "ImportRows",
                columns: new[] { "ImportJobId", "RowNumber" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ImportRows");

            migrationBuilder.DropTable(
                name: "ImportJobs");
        }
    }
}
