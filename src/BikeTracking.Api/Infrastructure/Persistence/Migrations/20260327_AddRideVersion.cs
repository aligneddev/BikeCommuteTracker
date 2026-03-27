using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BikeTracking.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRideVersion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Version",
                table: "Rides",
                type: "INTEGER",
                nullable: false,
                defaultValue: 1
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "Version", table: "Rides");
        }
    }
}
