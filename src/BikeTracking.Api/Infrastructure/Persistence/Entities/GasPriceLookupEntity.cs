namespace BikeTracking.Api.Infrastructure.Persistence.Entities;

public sealed class GasPriceLookupEntity
{
    public int GasPriceLookupId { get; set; }

    public DateOnly PriceDate { get; set; }

    /// <summary>
    /// The Sunday start date of the ISO week. Used as the cache key for weekly deduplication.
    /// Multiple price lookups within the same week share the same cached entry.
    /// </summary>
    public DateOnly WeekStartDate { get; set; }

    public decimal PricePerGallon { get; set; }

    public required string DataSource { get; set; }

    public DateOnly EiaPeriodDate { get; set; }

    public DateTime RetrievedAtUtc { get; set; }
}
