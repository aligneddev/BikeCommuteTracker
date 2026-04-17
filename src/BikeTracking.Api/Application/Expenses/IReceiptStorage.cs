namespace BikeTracking.Api.Application.Expenses;

public interface IReceiptStorage
{
    Task<string> SaveAsync(long riderId, long expenseId, string filename, Stream stream);

    Task DeleteAsync(string relativePath);

    Task<Stream> GetAsync(string relativePath);
}
