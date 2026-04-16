using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BikeTracking.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRideNotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "Rides",
                type: "TEXT",
                maxLength: 500,
                nullable: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "Notes", table: "Rides");
        }
    }
}
