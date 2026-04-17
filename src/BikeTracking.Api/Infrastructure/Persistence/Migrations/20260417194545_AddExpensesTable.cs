using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BikeTracking.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddExpensesTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Expenses",
                columns: table => new
                {
                    Id = table
                        .Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    RiderId = table.Column<long>(type: "INTEGER", nullable: false),
                    ExpenseDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Amount = table.Column<decimal>(
                        type: "TEXT",
                        precision: 10,
                        scale: 2,
                        nullable: false
                    ),
                    Notes = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    ReceiptPath = table.Column<string>(
                        type: "TEXT",
                        maxLength: 500,
                        nullable: true
                    ),
                    IsDeleted = table.Column<bool>(
                        type: "INTEGER",
                        nullable: false,
                        defaultValue: false
                    ),
                    Version = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 1),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Expenses", x => x.Id);
                    table.CheckConstraint(
                        "CK_Expenses_Amount_Positive",
                        "CAST(\"Amount\" AS REAL) > 0"
                    );
                    table.ForeignKey(
                        name: "FK_Expenses_Users_RiderId",
                        column: x => x.RiderId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_RiderId_ExpenseDate_Desc",
                table: "Expenses",
                columns: new[] { "RiderId", "ExpenseDate" },
                descending: new[] { false, true }
            );

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_RiderId_IsDeleted",
                table: "Expenses",
                columns: new[] { "RiderId", "IsDeleted" }
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "Expenses");
        }
    }
}
