using System.Text.Json;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Application.ExpenseImports;

public sealed class ExpenseDuplicateDetector(BikeTrackingDbContext dbContext)
{
    public async Task<
        IReadOnlyDictionary<int, IReadOnlyList<ExpenseEntity>>
    > GetDuplicateMatchesAsync(
        long riderId,
        IReadOnlyList<ExpenseImportCandidate> candidates,
        CancellationToken cancellationToken
    )
    {
        if (candidates.Count == 0)
        {
            return new Dictionary<int, IReadOnlyList<ExpenseEntity>>();
        }

        var activeExpenses = await dbContext
            .Expenses.AsNoTracking()
            .Where(expense => expense.RiderId == riderId && !expense.IsDeleted)
            .OrderBy(expense => expense.ExpenseDate)
            .ThenBy(expense => expense.Id)
            .ToListAsync(cancellationToken);

        var lookup = activeExpenses
            .GroupBy(static expense =>
                BuildKey(DateOnly.FromDateTime(expense.ExpenseDate), expense.Amount)
            )
            .ToDictionary(
                static group => group.Key,
                static group => (IReadOnlyList<ExpenseEntity>)group.ToList(),
                StringComparer.Ordinal
            );

        var results = new Dictionary<int, IReadOnlyList<ExpenseEntity>>();
        foreach (var candidate in candidates)
        {
            var key = BuildKey(candidate.ExpenseDateLocal, candidate.Amount);
            if (lookup.TryGetValue(key, out var matches))
            {
                results[candidate.RowNumber] = matches;
            }
        }

        return results;
    }

    public static string SerializeExistingExpenseIds(IReadOnlyList<ExpenseEntity> matches)
    {
        return JsonSerializer.Serialize(matches.Select(static expense => expense.Id).ToArray());
    }

    public static IReadOnlyList<long> DeserializeExistingExpenseIds(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        return JsonSerializer.Deserialize<long[]>(json) ?? [];
    }

    private static string BuildKey(DateOnly expenseDateLocal, decimal amount)
    {
        return $"{expenseDateLocal:yyyy-MM-dd}|{decimal.Round(amount, 2, MidpointRounding.AwayFromZero):0.00}";
    }
}

public sealed record ExpenseImportCandidate(
    int RowNumber,
    DateOnly ExpenseDateLocal,
    decimal Amount
);
