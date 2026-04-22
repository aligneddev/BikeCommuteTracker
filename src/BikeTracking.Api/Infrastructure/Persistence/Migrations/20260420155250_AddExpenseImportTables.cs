using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BikeTracking.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddExpenseImportTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ExpenseImportJobs",
                columns: table => new
                {
                    Id = table
                        .Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    RiderId = table.Column<long>(type: "INTEGER", nullable: false),
                    FileName = table.Column<string>(type: "TEXT", maxLength: 255, nullable: false),
                    TotalRows = table.Column<int>(
                        type: "INTEGER",
                        nullable: false,
                        defaultValue: 0
                    ),
                    ValidRows = table.Column<int>(
                        type: "INTEGER",
                        nullable: false,
                        defaultValue: 0
                    ),
                    InvalidRows = table.Column<int>(
                        type: "INTEGER",
                        nullable: false,
                        defaultValue: 0
                    ),
                    ImportedRows = table.Column<int>(
                        type: "INTEGER",
                        nullable: false,
                        defaultValue: 0
                    ),
                    SkippedRows = table.Column<int>(
                        type: "INTEGER",
                        nullable: false,
                        defaultValue: 0
                    ),
                    OverrideAllDuplicates = table.Column<bool>(
                        type: "INTEGER",
                        nullable: false,
                        defaultValue: false
                    ),
                    Status = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    LastError = table.Column<string>(type: "TEXT", maxLength: 1000, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CompletedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExpenseImportJobs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExpenseImportJobs_Users_RiderId",
                        column: x => x.RiderId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateTable(
                name: "ExpenseImportRows",
                columns: table => new
                {
                    Id = table
                        .Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ImportJobId = table.Column<long>(type: "INTEGER", nullable: false),
                    RowNumber = table.Column<int>(type: "INTEGER", nullable: false),
                    ExpenseDateLocal = table.Column<DateOnly>(type: "TEXT", nullable: true),
                    Amount = table.Column<decimal>(
                        type: "TEXT",
                        precision: 10,
                        scale: 2,
                        nullable: true
                    ),
                    Notes = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    ValidationStatus = table.Column<string>(
                        type: "TEXT",
                        maxLength: 30,
                        nullable: false
                    ),
                    ValidationErrorsJson = table.Column<string>(type: "TEXT", nullable: true),
                    DuplicateStatus = table.Column<string>(
                        type: "TEXT",
                        maxLength: 30,
                        nullable: false
                    ),
                    DuplicateResolution = table.Column<string>(
                        type: "TEXT",
                        maxLength: 30,
                        nullable: true
                    ),
                    ProcessingStatus = table.Column<string>(
                        type: "TEXT",
                        maxLength: 30,
                        nullable: false
                    ),
                    ExistingExpenseIdsJson = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedExpenseId = table.Column<long>(type: "INTEGER", nullable: true),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExpenseImportRows", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExpenseImportRows_ExpenseImportJobs_ImportJobId",
                        column: x => x.ImportJobId,
                        principalTable: "ExpenseImportJobs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateIndex(
                name: "IX_ExpenseImportJobs_RiderId",
                table: "ExpenseImportJobs",
                column: "RiderId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_ExpenseImportRows_ImportJobId",
                table: "ExpenseImportRows",
                column: "ImportJobId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_ExpenseImportRows_ImportJobId_RowNumber",
                table: "ExpenseImportRows",
                columns: new[] { "ImportJobId", "RowNumber" },
                unique: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "ExpenseImportRows");

            migrationBuilder.DropTable(name: "ExpenseImportJobs");
        }
    }
}
