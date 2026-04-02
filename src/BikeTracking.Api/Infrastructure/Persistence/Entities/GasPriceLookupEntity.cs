namespace BikeTracking.Api.Infrastructure.Persistence.Entities;

public sealed class GasPriceLookupEntity
{
    public int GasPriceLookupId { get; set; }

    public DateOnly PriceDate { get; set; }

    public decimal PricePerGallon { get; set; }

    public required string DataSource { get; set; }

    public DateOnly EiaPeriodDate { get; set; }

    public DateTime RetrievedAtUtc { get; set; }
}
