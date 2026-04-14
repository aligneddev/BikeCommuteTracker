using BikeTracking.Api.Contracts;

namespace BikeTracking.Api.Application.Imports;

public sealed record ImportDuplicateCandidate(
    int RowNumber,
    DateOnly Date,
    decimal Miles,
    decimal? Temperature
);

public interface IDuplicateResolutionService
{
    Task<IReadOnlyDictionary<int, IReadOnlyList<ImportDuplicateMatch>>> GetDuplicateMatchesAsync(
        long riderId,
        IReadOnlyList<ImportDuplicateCandidate> candidates,
        CancellationToken cancellationToken
    );
}
