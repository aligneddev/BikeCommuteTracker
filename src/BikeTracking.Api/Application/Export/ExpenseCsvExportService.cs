using BikeTracking.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Application.Export;

/// <summary>
/// Reads all non-deleted expense records for a rider and produces a UTF-8
/// RFC 4180-compliant CSV string with header row.
/// </summary>
/// <remarks>
/// Output columns: Date, Amount, Notes, CreatedAtUtc
/// Filter: WHERE RiderId = @riderId AND IsDeleted = false ORDER BY ExpenseDate DESC
/// </remarks>
public sealed class ExpenseCsvExportService(BikeTrackingDbContext db)
{
    private static readonly string[] Headers = ["Date", "Amount", "Notes", "CreatedAtUtc"];

    /// <summary>
    /// Generates the full CSV content as a UTF-8 string.
    /// Returns a header-only CSV when the rider has no expenses.
    /// </summary>
    public async Task<string> ExportAsync(
        long riderId,
        CancellationToken cancellationToken = default
    )
    {
        var expenses = await db
            .Expenses.Where(e => e.RiderId == riderId && !e.IsDeleted)
            .OrderByDescending(e => e.ExpenseDate)
            .ToListAsync(cancellationToken);

        var lines = new List<string>(expenses.Count + 1) { CsvRowBuilder.BuildHeader(Headers) };

        foreach (var expense in expenses)
        {
            var row = CsvRowBuilder.BuildRow([
                expense.ExpenseDate.ToString("yyyy-MM-dd"),
                expense.Amount.ToString("G29"),
                expense.Notes,
                expense.CreatedAtUtc.ToString("yyyy-MM-ddTHH:mm:ssZ"),
            ]);

            lines.Add(row);
        }

        return string.Join('\n', lines) + '\n';
    }
}
