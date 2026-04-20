using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Infrastructure.Persistence;

public sealed class BikeTrackingDbContext(DbContextOptions<BikeTrackingDbContext> options)
    : DbContext(options)
{
    public DbSet<UserEntity> Users => Set<UserEntity>();
    public DbSet<UserCredentialEntity> UserCredentials => Set<UserCredentialEntity>();
    public DbSet<AuthAttemptStateEntity> AuthAttemptStates => Set<AuthAttemptStateEntity>();
    public DbSet<OutboxEventEntity> OutboxEvents => Set<OutboxEventEntity>();
    public DbSet<RideEntity> Rides => Set<RideEntity>();
    public DbSet<ExpenseEntity> Expenses => Set<ExpenseEntity>();
    public DbSet<ExpenseImportJobEntity> ExpenseImportJobs => Set<ExpenseImportJobEntity>();
    public DbSet<ExpenseImportRowEntity> ExpenseImportRows => Set<ExpenseImportRowEntity>();
    public DbSet<ImportJobEntity> ImportJobs => Set<ImportJobEntity>();
    public DbSet<ImportRowEntity> ImportRows => Set<ImportRowEntity>();
    public DbSet<GasPriceLookupEntity> GasPriceLookups => Set<GasPriceLookupEntity>();
    public DbSet<WeatherLookupEntity> WeatherLookups => Set<WeatherLookupEntity>();
    public DbSet<UserSettingsEntity> UserSettings => Set<UserSettingsEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<UserEntity>(static entity =>
        {
            entity.ToTable("Users");
            entity.HasKey(static x => x.UserId);
            entity.Property(static x => x.DisplayName).IsRequired().HasMaxLength(120);
            entity.Property(static x => x.NormalizedName).IsRequired().HasMaxLength(120);
            entity.Property(static x => x.CreatedAtUtc).IsRequired();
            entity.Property(static x => x.IsActive).HasDefaultValue(true);

            entity.HasIndex(static x => x.NormalizedName).IsUnique();

            entity
                .HasOne(static x => x.Credential)
                .WithOne(static x => x.User)
                .HasForeignKey<UserCredentialEntity>(static x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity
                .HasOne(static x => x.AuthAttemptState)
                .WithOne(static x => x.User)
                .HasForeignKey<AuthAttemptStateEntity>(static x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserCredentialEntity>(static entity =>
        {
            entity.ToTable("UserCredentials");
            entity.HasKey(static x => x.UserCredentialId);
            entity.Property(static x => x.PinHash).IsRequired();
            entity.Property(static x => x.PinSalt).IsRequired();
            entity.Property(static x => x.HashAlgorithm).IsRequired().HasMaxLength(64);
            entity.Property(static x => x.IterationCount).IsRequired();
            entity.Property(static x => x.CredentialVersion).IsRequired();
            entity.Property(static x => x.UpdatedAtUtc).IsRequired();
        });

        modelBuilder.Entity<AuthAttemptStateEntity>(static entity =>
        {
            entity.ToTable("AuthAttemptStates");
            entity.HasKey(static x => x.UserId);
            entity.Property(static x => x.ConsecutiveWrongCount).HasDefaultValue(0);
            entity.Property(static x => x.LastWrongAttemptUtc);
            entity.Property(static x => x.DelayUntilUtc);
            entity.Property(static x => x.LastSuccessfulAuthUtc);
        });

        modelBuilder.Entity<OutboxEventEntity>(static entity =>
        {
            entity.ToTable("OutboxEvents");
            entity.HasKey(static x => x.OutboxEventId);
            entity.Property(static x => x.AggregateType).IsRequired().HasMaxLength(64);
            entity.Property(static x => x.AggregateId).IsRequired();
            entity.Property(static x => x.EventType).IsRequired().HasMaxLength(128);
            entity.Property(static x => x.EventPayloadJson).IsRequired();
            entity.Property(static x => x.OccurredAtUtc).IsRequired();
            entity.Property(static x => x.RetryCount).HasDefaultValue(0);
            entity.Property(static x => x.NextAttemptUtc).IsRequired();
            entity.Property(static x => x.PublishedAtUtc);
            entity.Property(static x => x.LastError).HasMaxLength(2048);

            entity.HasIndex(static x => new { x.PublishedAtUtc, x.NextAttemptUtc });
            entity.HasIndex(static x => new { x.AggregateType, x.AggregateId });
        });

        modelBuilder.Entity<RideEntity>(static entity =>
        {
            entity.ToTable(
                "Rides",
                static tableBuilder =>
                {
                    tableBuilder.HasCheckConstraint(
                        "CK_Rides_Miles_GreaterThanZero",
                        "CAST(\"Miles\" AS REAL) > 0 AND CAST(\"Miles\" AS REAL) <= 200"
                    );
                    tableBuilder.HasCheckConstraint(
                        "CK_Rides_RideMinutes_GreaterThanZero",
                        "\"RideMinutes\" IS NULL OR \"RideMinutes\" > 0"
                    );
                    tableBuilder.HasCheckConstraint(
                        "CK_Rides_SnapshotAverageCarMpg_Positive",
                        "\"SnapshotAverageCarMpg\" IS NULL OR CAST(\"SnapshotAverageCarMpg\" AS REAL) > 0"
                    );
                    tableBuilder.HasCheckConstraint(
                        "CK_Rides_SnapshotMileageRateCents_Positive",
                        "\"SnapshotMileageRateCents\" IS NULL OR CAST(\"SnapshotMileageRateCents\" AS REAL) > 0"
                    );
                    tableBuilder.HasCheckConstraint(
                        "CK_Rides_SnapshotYearlyGoalMiles_Positive",
                        "\"SnapshotYearlyGoalMiles\" IS NULL OR CAST(\"SnapshotYearlyGoalMiles\" AS REAL) > 0"
                    );
                    tableBuilder.HasCheckConstraint(
                        "CK_Rides_SnapshotOilChangePrice_Positive",
                        "\"SnapshotOilChangePrice\" IS NULL OR CAST(\"SnapshotOilChangePrice\" AS REAL) > 0"
                    );
                }
            );
            entity.HasKey(static x => x.Id);
            entity.Property(static x => x.RiderId).IsRequired();
            entity.Property(static x => x.RideDateTimeLocal).IsRequired();
            entity.Property(static x => x.Miles).IsRequired();
            entity.Property(static x => x.GasPricePerGallon).HasPrecision(10, 4);
            entity.Property(static x => x.SnapshotAverageCarMpg).HasPrecision(10, 4);
            entity.Property(static x => x.SnapshotMileageRateCents).HasPrecision(10, 4);
            entity.Property(static x => x.SnapshotYearlyGoalMiles).HasPrecision(10, 4);
            entity.Property(static x => x.SnapshotOilChangePrice).HasPrecision(10, 4);
            entity.Property(static x => x.WindSpeedMph).HasPrecision(10, 4);
            entity.Property(static x => x.WindDirectionDeg);
            entity.Property(static x => x.RelativeHumidityPercent);
            entity.Property(static x => x.CloudCoverPercent);
            entity.Property(static x => x.PrecipitationType).HasMaxLength(50);
            entity.Property(static x => x.Notes).HasMaxLength(500);
            entity.Property(static x => x.WeatherUserOverridden).HasDefaultValue(false);
            entity
                .Property(static x => x.Version)
                .IsRequired()
                .HasDefaultValue(1)
                .IsConcurrencyToken();
            entity.Property(static x => x.CreatedAtUtc).IsRequired();

            // Index for efficient defaults query
            entity
                .HasIndex(static x => new { x.RiderId, x.CreatedAtUtc })
                .IsDescending(false, true)
                .HasDatabaseName("IX_Rides_RiderId_CreatedAtUtc_Desc");

            // Foreign key to Users
            entity
                .HasOne<UserEntity>()
                .WithMany()
                .HasForeignKey(static x => x.RiderId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ExpenseEntity>(static entity =>
        {
            entity.ToTable(
                "Expenses",
                static tableBuilder =>
                {
                    tableBuilder.HasCheckConstraint(
                        "CK_Expenses_Amount_Positive",
                        "CAST(\"Amount\" AS REAL) > 0"
                    );
                }
            );
            entity.HasKey(static x => x.Id);
            entity.Property(static x => x.RiderId).IsRequired();
            entity.Property(static x => x.ExpenseDate).IsRequired();
            entity.Property(static x => x.Amount).IsRequired().HasPrecision(10, 2);
            entity.Property(static x => x.Notes).HasMaxLength(500);
            entity.Property(static x => x.ReceiptPath).HasMaxLength(500);
            entity.Property(static x => x.IsDeleted).HasDefaultValue(false);
            entity
                .Property(static x => x.Version)
                .IsRequired()
                .HasDefaultValue(1)
                .IsConcurrencyToken();
            entity.Property(static x => x.CreatedAtUtc).IsRequired();
            entity.Property(static x => x.UpdatedAtUtc).IsRequired();

            entity
                .HasIndex(static x => new { x.RiderId, x.ExpenseDate })
                .IsDescending(false, true)
                .HasDatabaseName("IX_Expenses_RiderId_ExpenseDate_Desc");

            entity
                .HasIndex(static x => new { x.RiderId, x.IsDeleted })
                .HasDatabaseName("IX_Expenses_RiderId_IsDeleted");

            entity
                .HasOne<UserEntity>()
                .WithMany()
                .HasForeignKey(static x => x.RiderId)
                .OnDelete(DeleteBehavior.Cascade);
        });

            modelBuilder.Entity<ExpenseImportJobEntity>(static entity =>
            {
                entity.ToTable("ExpenseImportJobs");
                entity.HasKey(static x => x.Id);
                entity.Property(static x => x.RiderId).IsRequired();
                entity.Property(static x => x.FileName).IsRequired().HasMaxLength(255);
                entity.Property(static x => x.TotalRows).HasDefaultValue(0);
                entity.Property(static x => x.ValidRows).HasDefaultValue(0);
                entity.Property(static x => x.InvalidRows).HasDefaultValue(0);
                entity.Property(static x => x.ImportedRows).HasDefaultValue(0);
                entity.Property(static x => x.SkippedRows).HasDefaultValue(0);
                entity.Property(static x => x.OverrideAllDuplicates).HasDefaultValue(false);
                entity.Property(static x => x.Status).IsRequired().HasMaxLength(50);
                entity.Property(static x => x.LastError).HasMaxLength(1000);
                entity.Property(static x => x.CreatedAtUtc).IsRequired();
                entity.Property(static x => x.CompletedAtUtc);

                entity.HasIndex(static x => x.RiderId).HasDatabaseName("IX_ExpenseImportJobs_RiderId");

                entity
                .HasOne<UserEntity>()
                .WithMany()
                .HasForeignKey(static x => x.RiderId)
                .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<ExpenseImportRowEntity>(static entity =>
            {
                entity.ToTable("ExpenseImportRows");
                entity.HasKey(static x => x.Id);
                entity.Property(static x => x.ImportJobId).IsRequired();
                entity.Property(static x => x.RowNumber).IsRequired();
                entity.Property(static x => x.ExpenseDateLocal);
                entity.Property(static x => x.Amount).HasPrecision(10, 2);
                entity.Property(static x => x.Notes).HasMaxLength(500);
                entity.Property(static x => x.ValidationStatus).IsRequired().HasMaxLength(30);
                entity.Property(static x => x.ValidationErrorsJson);
                entity.Property(static x => x.DuplicateStatus).IsRequired().HasMaxLength(30);
                entity.Property(static x => x.DuplicateResolution).HasMaxLength(30);
                entity.Property(static x => x.ProcessingStatus).IsRequired().HasMaxLength(30);
                entity.Property(static x => x.ExistingExpenseIdsJson);
                entity.Property(static x => x.CreatedExpenseId);

                entity.HasIndex(static x => x.ImportJobId).HasDatabaseName("IX_ExpenseImportRows_ImportJobId");
                entity.HasIndex(static x => new { x.ImportJobId, x.RowNumber }).IsUnique();

                entity
                .HasOne(static x => x.ImportJob)
                .WithMany(static x => x.Rows)
                .HasForeignKey(static x => x.ImportJobId)
                .OnDelete(DeleteBehavior.Cascade);
            });

        modelBuilder.Entity<ImportJobEntity>(static entity =>
        {
            entity.ToTable(
                "ImportJobs",
                static tableBuilder =>
                {
                    tableBuilder.HasCheckConstraint(
                        "CK_ImportJobs_TotalRows_NonNegative",
                        "\"TotalRows\" >= 0"
                    );
                    tableBuilder.HasCheckConstraint(
                        "CK_ImportJobs_ProcessedRows_NonNegative",
                        "\"ProcessedRows\" >= 0"
                    );
                    tableBuilder.HasCheckConstraint(
                        "CK_ImportJobs_ImportedRows_NonNegative",
                        "\"ImportedRows\" >= 0"
                    );
                    tableBuilder.HasCheckConstraint(
                        "CK_ImportJobs_SkippedRows_NonNegative",
                        "\"SkippedRows\" >= 0"
                    );
                    tableBuilder.HasCheckConstraint(
                        "CK_ImportJobs_FailedRows_NonNegative",
                        "\"FailedRows\" >= 0"
                    );
                    tableBuilder.HasCheckConstraint(
                        "CK_ImportJobs_ProcessedRows_Lte_TotalRows",
                        "\"ProcessedRows\" <= \"TotalRows\""
                    );
                }
            );

            entity.HasKey(static x => x.Id);
            entity.Property(static x => x.RiderId).IsRequired();
            entity.Property(static x => x.FileName).IsRequired().HasMaxLength(255);
            entity.Property(static x => x.TotalRows).HasDefaultValue(0);
            entity.Property(static x => x.ProcessedRows).HasDefaultValue(0);
            entity.Property(static x => x.ImportedRows).HasDefaultValue(0);
            entity.Property(static x => x.SkippedRows).HasDefaultValue(0);
            entity.Property(static x => x.FailedRows).HasDefaultValue(0);
            entity.Property(static x => x.Status).IsRequired().HasMaxLength(50);
            entity.Property(static x => x.OverrideAllDuplicates).HasDefaultValue(false);
            entity.Property(static x => x.EtaMinutesRounded);
            entity.Property(static x => x.CreatedAtUtc).IsRequired();
            entity.Property(static x => x.StartedAtUtc);
            entity.Property(static x => x.CompletedAtUtc);
            entity.Property(static x => x.LastError).HasMaxLength(2048);

            entity.HasIndex(static x => new { x.RiderId, x.CreatedAtUtc });

            entity
                .HasOne<UserEntity>()
                .WithMany()
                .HasForeignKey(static x => x.RiderId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ImportRowEntity>(static entity =>
        {
            entity.ToTable(
                "ImportRows",
                static tableBuilder =>
                {
                    tableBuilder.HasCheckConstraint(
                        "CK_ImportRows_RowNumber_Positive",
                        "\"RowNumber\" > 0"
                    );
                    tableBuilder.HasCheckConstraint(
                        "CK_ImportRows_Miles_Range",
                        "\"Miles\" IS NULL OR (CAST(\"Miles\" AS REAL) > 0 AND CAST(\"Miles\" AS REAL) <= 200)"
                    );
                    tableBuilder.HasCheckConstraint(
                        "CK_ImportRows_RideMinutes_Positive",
                        "\"RideMinutes\" IS NULL OR \"RideMinutes\" > 0"
                    );
                }
            );

            entity.HasKey(static x => x.Id);
            entity.Property(static x => x.ImportJobId).IsRequired();
            entity.Property(static x => x.RowNumber).IsRequired();
            entity.Property(static x => x.RideDateLocal);
            entity.Property(static x => x.Miles).HasPrecision(10, 4);
            entity.Property(static x => x.RideMinutes);
            entity.Property(static x => x.Temperature).HasPrecision(10, 4);
            entity.Property(static x => x.TagsRaw).HasMaxLength(512);
            entity.Property(static x => x.Notes).HasMaxLength(2000);
            entity.Property(static x => x.ValidationStatus).IsRequired().HasMaxLength(30);
            entity.Property(static x => x.ValidationErrorsJson);
            entity.Property(static x => x.DuplicateStatus).IsRequired().HasMaxLength(30);
            entity.Property(static x => x.DuplicateResolution).HasMaxLength(30);
            entity.Property(static x => x.ProcessingStatus).IsRequired().HasMaxLength(30);
            entity.Property(static x => x.ExistingRideIdsJson);
            entity.Property(static x => x.CreatedRideId);

            entity.HasIndex(static x => new { x.ImportJobId, x.RowNumber }).IsUnique();

            entity
                .HasOne(static x => x.ImportJob)
                .WithMany(static x => x.Rows)
                .HasForeignKey(static x => x.ImportJobId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<GasPriceLookupEntity>(static entity =>
        {
            entity.ToTable("GasPriceLookups");
            entity.HasKey(static x => x.GasPriceLookupId);

            entity.Property(static x => x.PriceDate).IsRequired();
            entity.Property(static x => x.WeekStartDate).IsRequired();
            entity.Property(static x => x.PricePerGallon).IsRequired().HasPrecision(10, 4);
            entity.Property(static x => x.DataSource).IsRequired().HasMaxLength(64);
            entity.Property(static x => x.EiaPeriodDate).IsRequired();
            entity.Property(static x => x.RetrievedAtUtc).IsRequired();

            entity.HasIndex(static x => x.PriceDate).IsUnique();
            entity.HasIndex(static x => x.WeekStartDate).IsUnique();
        });

        modelBuilder.Entity<WeatherLookupEntity>(static entity =>
        {
            entity.ToTable("WeatherLookups");
            entity.HasKey(static x => x.WeatherLookupId);

            entity.Property(static x => x.LookupHourUtc).IsRequired();
            entity.Property(static x => x.LatitudeRounded).IsRequired().HasPrecision(8, 2);
            entity.Property(static x => x.LongitudeRounded).IsRequired().HasPrecision(8, 2);
            entity.Property(static x => x.Temperature).HasPrecision(10, 4);
            entity.Property(static x => x.WindSpeedMph).HasPrecision(10, 4);
            entity.Property(static x => x.WindDirectionDeg);
            entity.Property(static x => x.RelativeHumidityPercent);
            entity.Property(static x => x.CloudCoverPercent);
            entity.Property(static x => x.PrecipitationType).HasMaxLength(50);
            entity.Property(static x => x.DataSource).IsRequired().HasMaxLength(100);
            entity.Property(static x => x.RetrievedAtUtc).IsRequired();
            entity.Property(static x => x.Status).IsRequired().HasMaxLength(50);

            entity
                .HasIndex(static x => new
                {
                    x.LookupHourUtc,
                    x.LatitudeRounded,
                    x.LongitudeRounded,
                })
                .IsUnique();
        });

        modelBuilder.Entity<UserSettingsEntity>(static entity =>
        {
            entity.ToTable(
                "UserSettings",
                static tableBuilder =>
                {
                    tableBuilder.HasCheckConstraint(
                        "CK_UserSettings_AverageCarMpg_Positive",
                        "\"AverageCarMpg\" IS NULL OR CAST(\"AverageCarMpg\" AS REAL) > 0"
                    );
                    tableBuilder.HasCheckConstraint(
                        "CK_UserSettings_YearlyGoalMiles_Positive",
                        "\"YearlyGoalMiles\" IS NULL OR CAST(\"YearlyGoalMiles\" AS REAL) > 0"
                    );
                    tableBuilder.HasCheckConstraint(
                        "CK_UserSettings_OilChangePrice_Positive",
                        "\"OilChangePrice\" IS NULL OR CAST(\"OilChangePrice\" AS REAL) > 0"
                    );
                    tableBuilder.HasCheckConstraint(
                        "CK_UserSettings_MileageRateCents_Positive",
                        "\"MileageRateCents\" IS NULL OR CAST(\"MileageRateCents\" AS REAL) > 0"
                    );
                    tableBuilder.HasCheckConstraint(
                        "CK_UserSettings_Latitude_Range",
                        "\"Latitude\" IS NULL OR (CAST(\"Latitude\" AS REAL) >= -90 AND CAST(\"Latitude\" AS REAL) <= 90)"
                    );
                    tableBuilder.HasCheckConstraint(
                        "CK_UserSettings_Longitude_Range",
                        "\"Longitude\" IS NULL OR (CAST(\"Longitude\" AS REAL) >= -180 AND CAST(\"Longitude\" AS REAL) <= 180)"
                    );
                }
            );

            entity.HasKey(static x => x.UserId);
            entity.Property(static x => x.AverageCarMpg);
            entity.Property(static x => x.YearlyGoalMiles);
            entity.Property(static x => x.OilChangePrice);
            entity.Property(static x => x.MileageRateCents);
            entity.Property(static x => x.LocationLabel).HasMaxLength(200);
            entity.Property(static x => x.Latitude);
            entity.Property(static x => x.Longitude);
            entity
                .Property(static x => x.DashboardGallonsAvoidedEnabled)
                .IsRequired()
                .HasDefaultValue(false);
            entity
                .Property(static x => x.DashboardGoalProgressEnabled)
                .IsRequired()
                .HasDefaultValue(false);
            entity.Property(static x => x.UpdatedAtUtc).IsRequired();

            entity
                .HasOne<UserEntity>()
                .WithMany()
                .HasForeignKey(static x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}

public sealed class UserEntity
{
    public long UserId { get; set; }
    public required string DisplayName { get; set; }
    public required string NormalizedName { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public bool IsActive { get; set; } = true;

    public UserCredentialEntity? Credential { get; set; }
    public AuthAttemptStateEntity? AuthAttemptState { get; set; }
}

public sealed class UserCredentialEntity
{
    public long UserCredentialId { get; set; }
    public long UserId { get; set; }
    public required byte[] PinHash { get; set; }
    public required byte[] PinSalt { get; set; }
    public required string HashAlgorithm { get; set; }
    public int IterationCount { get; set; }
    public int CredentialVersion { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public UserEntity User { get; set; } = null!;
}

public sealed class AuthAttemptStateEntity
{
    public long UserId { get; set; }
    public int ConsecutiveWrongCount { get; set; }
    public DateTime? LastWrongAttemptUtc { get; set; }
    public DateTime? DelayUntilUtc { get; set; }
    public DateTime? LastSuccessfulAuthUtc { get; set; }

    public UserEntity User { get; set; } = null!;
}

public sealed class OutboxEventEntity
{
    public long OutboxEventId { get; set; }
    public required string AggregateType { get; set; }
    public long AggregateId { get; set; }
    public required string EventType { get; set; }
    public required string EventPayloadJson { get; set; }
    public DateTime OccurredAtUtc { get; set; }
    public int RetryCount { get; set; }
    public DateTime NextAttemptUtc { get; set; }
    public DateTime? PublishedAtUtc { get; set; }
    public string? LastError { get; set; }
}
