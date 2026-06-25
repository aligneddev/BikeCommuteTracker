using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BikeTracking.Api.src.BikeTracking.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DropOutboxEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "OutboxEvents");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OutboxEvents",
                columns: table => new
                {
                    OutboxEventId = table
                        .Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    AggregateId = table.Column<long>(type: "INTEGER", nullable: false),
                    AggregateType = table.Column<string>(
                        type: "TEXT",
                        maxLength: 64,
                        nullable: false
                    ),
                    EventPayloadJson = table.Column<string>(type: "TEXT", nullable: false),
                    EventType = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    LastError = table.Column<string>(type: "TEXT", maxLength: 2048, nullable: true),
                    NextAttemptUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    OccurredAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    PublishedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    RetryCount = table.Column<int>(
                        type: "INTEGER",
                        nullable: false,
                        defaultValue: 0
                    ),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OutboxEvents", x => x.OutboxEventId);
                }
            );

            migrationBuilder.CreateIndex(
                name: "IX_OutboxEvents_AggregateType_AggregateId",
                table: "OutboxEvents",
                columns: new[] { "AggregateType", "AggregateId" }
            );

            migrationBuilder.CreateIndex(
                name: "IX_OutboxEvents_PublishedAtUtc_NextAttemptUtc",
                table: "OutboxEvents",
                columns: new[] { "PublishedAtUtc", "NextAttemptUtc" }
            );
        }
    }
}
