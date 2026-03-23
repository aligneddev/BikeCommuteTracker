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
                        "\"Miles\" > 0"
                    );
                    tableBuilder.HasCheckConstraint(
                        "CK_Rides_RideMinutes_GreaterThanZero",
                        "\"RideMinutes\" IS NULL OR \"RideMinutes\" > 0"
                    );
                }
            );
            entity.HasKey(static x => x.Id);
            entity.Property(static x => x.RiderId).IsRequired();
            entity.Property(static x => x.RideDateTimeLocal).IsRequired();
            entity.Property(static x => x.Miles).IsRequired();
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
