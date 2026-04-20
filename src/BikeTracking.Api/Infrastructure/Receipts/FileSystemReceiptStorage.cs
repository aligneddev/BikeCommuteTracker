using BikeTracking.Api.Application.Expenses;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Logging.Abstractions;

namespace BikeTracking.Api.Infrastructure.Receipts;

public sealed class FileSystemReceiptStorage : IReceiptStorage
{
    private readonly string receiptsRootPath;
    private readonly ILogger<FileSystemReceiptStorage> logger;

    public FileSystemReceiptStorage(
        IConfiguration configuration,
        ILogger<FileSystemReceiptStorage> logger
    )
        : this(ResolveReceiptsRoot(configuration))
    {
        this.logger = logger;
    }

    public FileSystemReceiptStorage(string receiptsRootPath)
    {
        this.receiptsRootPath = Path.GetFullPath(receiptsRootPath);
        this.logger = NullLogger<FileSystemReceiptStorage>.Instance;
    }

    public async Task<string> SaveAsync(
        long riderId,
        long expenseId,
        string filename,
        Stream stream
    )
    {
        var extension = Path.GetExtension(filename);
        var generatedFileName = $"{Guid.NewGuid():N}{extension}";
        var relativePath = Path.Combine(
            riderId.ToString(),
            expenseId.ToString(),
            generatedFileName
        );
        var fullPath = ResolveFullPath(relativePath);
        var directory = Path.GetDirectoryName(fullPath);

        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }

        if (stream.CanSeek)
        {
            stream.Position = 0;
        }

        try
        {
            await using var fileStream = new FileStream(
                fullPath,
                FileMode.Create,
                FileAccess.Write
            );
            await stream.CopyToAsync(fileStream);
        }
        catch (IOException ex)
        {
            logger.LogError(
                ex,
                "Failed to write receipt file at {FullPath}: I/O or disk error — {Reason}",
                fullPath,
                ex.Message
            );
            throw;
        }
        catch (UnauthorizedAccessException ex)
        {
            logger.LogError(
                ex,
                "Failed to write receipt file at {FullPath}: permission denied — {Reason}",
                fullPath,
                ex.Message
            );
            throw;
        }

        return relativePath.Replace(Path.DirectorySeparatorChar, '/');
    }

    public Task DeleteAsync(string relativePath)
    {
        var fullPath = ResolveFullPath(relativePath);

        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }

        return Task.CompletedTask;
    }

    public Task<Stream> GetAsync(string relativePath)
    {
        var fullPath = ResolveFullPath(relativePath);
        Stream fileStream = new FileStream(
            fullPath,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read
        );
        return Task.FromResult(fileStream);
    }

    private string ResolveFullPath(string relativePath)
    {
        var normalizedRelativePath = relativePath.Replace('/', Path.DirectorySeparatorChar);
        var fullPath = Path.GetFullPath(Path.Combine(receiptsRootPath, normalizedRelativePath));

        if (!fullPath.StartsWith(receiptsRootPath, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Receipt path must stay within the receipts root.");
        }

        return fullPath;
    }

    private static string ResolveReceiptsRoot(IConfiguration configuration)
    {
        var connectionString =
            configuration.GetConnectionString("BikeTracking")
            ?? "Data Source=biketracking.local.db";
        var sqliteBuilder = new SqliteConnectionStringBuilder(connectionString);
        var dataSource = sqliteBuilder.DataSource;

        if (string.IsNullOrWhiteSpace(dataSource))
        {
            dataSource = "biketracking.local.db";
        }

        if (!Path.IsPathRooted(dataSource))
        {
            dataSource = Path.GetFullPath(dataSource, AppContext.BaseDirectory);
        }

        var databaseDirectory = Path.GetDirectoryName(dataSource) ?? AppContext.BaseDirectory;
        return Path.Combine(databaseDirectory, "receipts");
    }
}
