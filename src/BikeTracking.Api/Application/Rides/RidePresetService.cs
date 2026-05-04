using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Application.Rides;

public interface IRidePresetService
{
    Task<RidePresetsResponse> ListAsync(
        long riderId,
        CancellationToken cancellationToken = default
    );

    Task<RidePresetResult> CreateAsync(
        long riderId,
        UpsertRidePresetRequest request,
        CancellationToken cancellationToken = default
    );

    Task<RidePresetResult> UpdateAsync(
        long riderId,
        long presetId,
        UpsertRidePresetRequest request,
        CancellationToken cancellationToken = default
    );

    Task<RidePresetDeleteResult> DeleteAsync(
        long riderId,
        long presetId,
        CancellationToken cancellationToken = default
    );
}

public sealed class RidePresetService(BikeTrackingDbContext dbContext) : IRidePresetService
{
    private readonly BikeTrackingDbContext _dbContext = dbContext;

    public async Task<RidePresetsResponse> ListAsync(
        long riderId,
        CancellationToken cancellationToken = default
    )
    {
        var presets = await _dbContext
            .RidePresets.AsNoTracking()
            .Where(x => x.RiderId == riderId)
            .OrderByDescending(x => x.LastUsedAtUtc)
            .ThenByDescending(x => x.UpdatedAtUtc)
            .Select(x => ToDto(x))
            .ToListAsync(cancellationToken);

        return new RidePresetsResponse(presets, DateTime.UtcNow);
    }

    public async Task<RidePresetResult> CreateAsync(
        long riderId,
        UpsertRidePresetRequest request,
        CancellationToken cancellationToken = default
    )
    {
        if (!TimeOnly.TryParseExact(request.ExactStartTimeLocal, "HH:mm", out var exactTime))
        {
            return RidePresetResult.Failure(
                "VALIDATION_FAILED",
                "Exact start time must be in HH:mm format."
            );
        }

        var exists = await _dbContext.RidePresets.AnyAsync(
            x => x.RiderId == riderId && x.Name == request.Name,
            cancellationToken
        );

        if (exists)
        {
            return RidePresetResult.Failure(
                "VALIDATION_FAILED",
                "A preset with this name already exists for this rider."
            );
        }

        var now = DateTime.UtcNow;
        var entity = new RidePresetEntity
        {
            RiderId = riderId,
            Name = request.Name,
            PrimaryDirection = request.PrimaryDirection,
            PeriodTag = request.PeriodTag,
            ExactStartTimeLocal = exactTime,
            DurationMinutes = request.DurationMinutes,
            LastUsedAtUtc = null,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
            Version = 1,
        };

        _dbContext.RidePresets.Add(entity);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return RidePresetResult.Success(ToDto(entity));
    }

    public async Task<RidePresetResult> UpdateAsync(
        long riderId,
        long presetId,
        UpsertRidePresetRequest request,
        CancellationToken cancellationToken = default
    )
    {
        if (!TimeOnly.TryParseExact(request.ExactStartTimeLocal, "HH:mm", out var exactTime))
        {
            return RidePresetResult.Failure(
                "VALIDATION_FAILED",
                "Exact start time must be in HH:mm format."
            );
        }

        var existing = await _dbContext.RidePresets.SingleOrDefaultAsync(
            x => x.RidePresetId == presetId && x.RiderId == riderId,
            cancellationToken
        );

        if (existing is null)
        {
            return RidePresetResult.Failure("PRESET_NOT_FOUND", "Ride preset was not found.");
        }

        var duplicateName = await _dbContext.RidePresets.AnyAsync(
            x => x.RiderId == riderId && x.RidePresetId != presetId && x.Name == request.Name,
            cancellationToken
        );

        if (duplicateName)
        {
            return RidePresetResult.Failure(
                "VALIDATION_FAILED",
                "A preset with this name already exists for this rider."
            );
        }

        existing.Name = request.Name;
        existing.PrimaryDirection = request.PrimaryDirection;
        existing.PeriodTag = request.PeriodTag;
        existing.ExactStartTimeLocal = exactTime;
        existing.DurationMinutes = request.DurationMinutes;
        existing.UpdatedAtUtc = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        return RidePresetResult.Success(ToDto(existing));
    }

    public async Task<RidePresetDeleteResult> DeleteAsync(
        long riderId,
        long presetId,
        CancellationToken cancellationToken = default
    )
    {
        var existing = await _dbContext.RidePresets.SingleOrDefaultAsync(
            x => x.RidePresetId == presetId && x.RiderId == riderId,
            cancellationToken
        );

        if (existing is null)
        {
            return RidePresetDeleteResult.Failure("PRESET_NOT_FOUND", "Ride preset was not found.");
        }

        _dbContext.RidePresets.Remove(existing);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return RidePresetDeleteResult.Success(
            new DeleteRidePresetResponse(existing.RidePresetId, DateTime.UtcNow, "Preset deleted")
        );
    }

    private static RidePresetDto ToDto(RidePresetEntity entity)
    {
        return new RidePresetDto(
            PresetId: entity.RidePresetId,
            Name: entity.Name,
            PrimaryDirection: entity.PrimaryDirection,
            PeriodTag: entity.PeriodTag,
            ExactStartTimeLocal: entity.ExactStartTimeLocal.ToString("HH:mm"),
            DurationMinutes: entity.DurationMinutes,
            LastUsedAtUtc: entity.LastUsedAtUtc,
            UpdatedAtUtc: entity.UpdatedAtUtc
        );
    }
}

public sealed record RidePresetResult(bool IsSuccess, RidePresetDto? Preset, ErrorResponse? Error)
{
    public static RidePresetResult Success(RidePresetDto preset) => new(true, preset, null);

    public static RidePresetResult Failure(string code, string message) =>
        new(false, null, new ErrorResponse(code, message));
}

public sealed record RidePresetDeleteResult(
    bool IsSuccess,
    DeleteRidePresetResponse? Response,
    ErrorResponse? Error
)
{
    public static RidePresetDeleteResult Success(DeleteRidePresetResponse response) =>
        new(true, response, null);

    public static RidePresetDeleteResult Failure(string code, string message) =>
        new(false, null, new ErrorResponse(code, message));
}
