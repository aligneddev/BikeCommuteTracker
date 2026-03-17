using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BikeTracking.Api.Infrastructure.Persistence.Migrations;

[DbContext(typeof(BikeTrackingDbContext))]
[Migration("202603130001_InitialUserIdentity")]
public partial class InitialUserIdentity20260313 : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "OutboxEvents",
            columns: table => new
            {
                OutboxEventId = table
                    .Column<long>(type: "INTEGER", nullable: false)
                    .Annotation("Sqlite:Autoincrement", true),
                AggregateType = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                AggregateId = table.Column<long>(type: "INTEGER", nullable: false),
                EventType = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                EventPayloadJson = table.Column<string>(type: "TEXT", nullable: false),
                OccurredAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                RetryCount = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 0),
                NextAttemptUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                PublishedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                LastError = table.Column<string>(type: "TEXT", maxLength: 2048, nullable: true),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_OutboxEvents", x => x.OutboxEventId);
            }
        );

        migrationBuilder.CreateTable(
            name: "Users",
            columns: table => new
            {
                UserId = table
                    .Column<long>(type: "INTEGER", nullable: false)
                    .Annotation("Sqlite:Autoincrement", true),
                DisplayName = table.Column<string>(type: "TEXT", maxLength: 120, nullable: false),
                NormalizedName = table.Column<string>(
                    type: "TEXT",
                    maxLength: 120,
                    nullable: false
                ),
                CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                IsActive = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: true),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Users", x => x.UserId);
            }
        );

        migrationBuilder.CreateTable(
            name: "AuthAttemptStates",
            columns: table => new
            {
                UserId = table.Column<long>(type: "INTEGER", nullable: false),
                ConsecutiveWrongCount = table.Column<int>(
                    type: "INTEGER",
                    nullable: false,
                    defaultValue: 0
                ),
                LastWrongAttemptUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                DelayUntilUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                LastSuccessfulAuthUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_AuthAttemptStates", x => x.UserId);
                table.ForeignKey(
                    name: "FK_AuthAttemptStates_Users_UserId",
                    column: x => x.UserId,
                    principalTable: "Users",
                    principalColumn: "UserId",
                    onDelete: ReferentialAction.Cascade
                );
            }
        );

        migrationBuilder.CreateTable(
            name: "UserCredentials",
            columns: table => new
            {
                UserCredentialId = table
                    .Column<long>(type: "INTEGER", nullable: false)
                    .Annotation("Sqlite:Autoincrement", true),
                UserId = table.Column<long>(type: "INTEGER", nullable: false),
                PinHash = table.Column<byte[]>(type: "BLOB", nullable: false),
                PinSalt = table.Column<byte[]>(type: "BLOB", nullable: false),
                HashAlgorithm = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                IterationCount = table.Column<int>(type: "INTEGER", nullable: false),
                CredentialVersion = table.Column<int>(type: "INTEGER", nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_UserCredentials", x => x.UserCredentialId);
                table.ForeignKey(
                    name: "FK_UserCredentials_Users_UserId",
                    column: x => x.UserId,
                    principalTable: "Users",
                    principalColumn: "UserId",
                    onDelete: ReferentialAction.Cascade
                );
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

        migrationBuilder.CreateIndex(
            name: "IX_UserCredentials_UserId",
            table: "UserCredentials",
            column: "UserId",
            unique: true
        );

        migrationBuilder.CreateIndex(
            name: "IX_Users_NormalizedName",
            table: "Users",
            column: "NormalizedName",
            unique: true
        );
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "AuthAttemptStates");
        migrationBuilder.DropTable(name: "OutboxEvents");
        migrationBuilder.DropTable(name: "UserCredentials");
        migrationBuilder.DropTable(name: "Users");
    }
}
