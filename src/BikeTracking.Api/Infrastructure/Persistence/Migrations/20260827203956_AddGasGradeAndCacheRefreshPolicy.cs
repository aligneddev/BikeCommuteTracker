using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BikeTracking.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGasGradeAndCacheRefreshPolicy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_GasPriceLookups_PriceDate",
                table: "GasPriceLookups");

            migrationBuilder.DropIndex(
                name: "IX_GasPriceLookups_WeekStartDate",
                table: "GasPriceLookups");

            migrationBuilder.AddColumn<string>(
                name: "GasGrade",
                table: "UserSettings",
                type: "TEXT",
                maxLength: 20,
                nullable: false,
                defaultValue: "Regular");

            migrationBuilder.AddColumn<string>(
                name: "Grade",
                table: "GasPriceLookups",
                type: "TEXT",
                maxLength: 20,
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE "UserSettings"
                SET "GasGrade" = 'Premium';
                """
            );

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserSettings_GasGrade_Valid",
                table: "UserSettings",
                sql: "\"GasGrade\" IN ('Regular', 'Premium')");

            migrationBuilder.CreateIndex(
                name: "IX_GasPriceLookups_WeekStartDate_Grade",
                table: "GasPriceLookups",
                columns: new[] { "WeekStartDate", "Grade" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_UserSettings_GasGrade_Valid",
                table: "UserSettings");

            migrationBuilder.DropIndex(
                name: "IX_GasPriceLookups_WeekStartDate_Grade",
                table: "GasPriceLookups");

            migrationBuilder.DropColumn(
                name: "GasGrade",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "Grade",
                table: "GasPriceLookups");

            migrationBuilder.CreateIndex(
                name: "IX_GasPriceLookups_PriceDate",
                table: "GasPriceLookups",
                column: "PriceDate",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GasPriceLookups_WeekStartDate",
                table: "GasPriceLookups",
                column: "WeekStartDate",
                unique: true);
        }
    }
}
