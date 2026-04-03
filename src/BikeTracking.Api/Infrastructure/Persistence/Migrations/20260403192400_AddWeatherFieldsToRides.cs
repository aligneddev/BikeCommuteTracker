using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BikeTracking.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWeatherFieldsToRides : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CloudCoverPercent",
                table: "Rides",
                type: "INTEGER",
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "PrecipitationType",
                table: "Rides",
                type: "TEXT",
                maxLength: 50,
                nullable: true
            );

            migrationBuilder.AddColumn<int>(
                name: "RelativeHumidityPercent",
                table: "Rides",
                type: "INTEGER",
                nullable: true
            );

            migrationBuilder.AddColumn<bool>(
                name: "WeatherUserOverridden",
                table: "Rides",
                type: "INTEGER",
                nullable: false,
                defaultValue: false
            );

            migrationBuilder.AddColumn<int>(
                name: "WindDirectionDeg",
                table: "Rides",
                type: "INTEGER",
                nullable: true
            );

            migrationBuilder.AddColumn<decimal>(
                name: "WindSpeedMph",
                table: "Rides",
                type: "TEXT",
                precision: 10,
                scale: 4,
                nullable: true
            );

            migrationBuilder.CreateTable(
                name: "WeatherLookups",
                columns: table => new
                {
                    WeatherLookupId = table
                        .Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    LookupHourUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    LatitudeRounded = table.Column<decimal>(
                        type: "TEXT",
                        precision: 8,
                        scale: 2,
                        nullable: false
                    ),
                    LongitudeRounded = table.Column<decimal>(
                        type: "TEXT",
                        precision: 8,
                        scale: 2,
                        nullable: false
                    ),
                    Temperature = table.Column<decimal>(
                        type: "TEXT",
                        precision: 10,
                        scale: 4,
                        nullable: true
                    ),
                    WindSpeedMph = table.Column<decimal>(
                        type: "TEXT",
                        precision: 10,
                        scale: 4,
                        nullable: true
                    ),
                    WindDirectionDeg = table.Column<int>(type: "INTEGER", nullable: true),
                    RelativeHumidityPercent = table.Column<int>(type: "INTEGER", nullable: true),
                    CloudCoverPercent = table.Column<int>(type: "INTEGER", nullable: true),
                    PrecipitationType = table.Column<string>(
                        type: "TEXT",
                        maxLength: 50,
                        nullable: true
                    ),
                    DataSource = table.Column<string>(
                        type: "TEXT",
                        maxLength: 100,
                        nullable: false
                    ),
                    RetrievedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WeatherLookups", x => x.WeatherLookupId);
                }
            );

            migrationBuilder.CreateIndex(
                name: "IX_WeatherLookups_LookupHourUtc_LatitudeRounded_LongitudeRounded",
                table: "WeatherLookups",
                columns: new[] { "LookupHourUtc", "LatitudeRounded", "LongitudeRounded" },
                unique: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "WeatherLookups");

            migrationBuilder.DropColumn(name: "CloudCoverPercent", table: "Rides");

            migrationBuilder.DropColumn(name: "PrecipitationType", table: "Rides");

            migrationBuilder.DropColumn(name: "RelativeHumidityPercent", table: "Rides");

            migrationBuilder.DropColumn(name: "WeatherUserOverridden", table: "Rides");

            migrationBuilder.DropColumn(name: "WindDirectionDeg", table: "Rides");

            migrationBuilder.DropColumn(name: "WindSpeedMph", table: "Rides");
        }
    }
}
