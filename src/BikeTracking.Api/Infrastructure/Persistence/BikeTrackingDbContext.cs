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
        modelBuilder.Entity<UserEntity>(entity =>
        {
            entity.ToTable("Users");
            entity.HasKey(x => x.UserId);
            entity.Property(x => x.DisplayName).IsRequired().HasMaxLength(120);
            entity.Property(x => x.NormalizedName).IsRequired().HasMaxLength(120);
            entity.Property(x => x.CreatedAtUtc).IsRequired();
            entity.Property(x => x.IsActive).HasDefaultValue(true);

            entity.HasIndex(x => x.NormalizedName).IsUnique();

            entity
                .HasOne(x => x.Credential)
                .WithOne(x => x.User)
                .HasForeignKey<UserCredentialEntity>(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity
                .HasOne(x => x.AuthAttemptState)
                .WithOne(x => x.User)
                .HasForeignKey<AuthAttemptStateEntity>(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserCredentialEntity>(entity =>
        {
            entity.ToTable("UserCredentials");
            entity.HasKey(x => x.UserCredentialId);
            entity.Property(x => x.PinHash).IsRequired();
            entity.Property(x => x.PinSalt).IsRequired();
            entity.Property(x => x.HashAlgorithm).IsRequired().HasMaxLength(64);
            entity.Property(x => x.IterationCount).IsRequired();
            entity.Property(x => x.CredentialVersion).IsRequired();
            entity.Property(x => x.UpdatedAtUtc).IsRequired();
        });

        modelBuilder.Entity<AuthAttemptStateEntity>(entity =>
        {
            entity.ToTable("AuthAttemptStates");
            entity.HasKey(x => x.UserId);
            entity.Property(x => x.ConsecutiveWrongCount).HasDefaultValue(0);
            entity.Property(x => x.LastWrongAttemptUtc);
            entity.Property(x => x.DelayUntilUtc);
            entity.Property(x => x.LastSuccessfulAuthUtc);
        });

        modelBuilder.Entity<OutboxEventEntity>(entity =>
        {
            entity.ToTable("OutboxEvents");
            entity.HasKey(x => x.OutboxEventId);
            entity.Property(x => x.AggregateType).IsRequired().HasMaxLength(64);
            entity.Property(x => x.AggregateId).IsRequired();
            entity.Property(x => x.EventType).IsRequired().HasMaxLength(128);
            entity.Property(x => x.EventPayloadJson).IsRequired();
            entity.Property(x => x.OccurredAtUtc).IsRequired();
            entity.Property(x => x.RetryCount).HasDefaultValue(0);
            entity.Property(x => x.NextAttemptUtc).IsRequired();
            entity.Property(x => x.PublishedAtUtc);
            entity.Property(x => x.LastError).HasMaxLength(2048);

            entity.HasIndex(x => new { x.PublishedAtUtc, x.NextAttemptUtc });
            entity.HasIndex(x => new { x.AggregateType, x.AggregateId });
        });

        modelBuilder.Entity<RideEntity>(entity =>
        {
            entity.ToTable("Rides");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.RiderId).IsRequired();
            entity.Property(x => x.RideDateTimeLocal).IsRequired();
            entity.Property(x => x.Miles).IsRequired();
            entity.Property(x => x.CreatedAtUtc).IsRequired();

            // Check constraints
            entity.HasCheckConstraint("CK_Rides_Miles_GreaterThanZero", "\"Miles\" > 0");
            entity.HasCheckConstraint(
                "CK_Rides_RideMinutes_GreaterThanZero",
                "\"RideMinutes\" IS NULL OR \"RideMinutes\" > 0"
            );

            // Index for efficient defaults query
            entity
                .HasIndex(x => new { x.RiderId, x.CreatedAtUtc })
                .IsDescending(false, true)
                .HasDatabaseName("IX_Rides_RiderId_CreatedAtUtc_Desc");

            // Foreign key to Users
            entity
                .HasOne<UserEntity>()
                .WithMany()
                .HasForeignKey(x => x.RiderId)
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
