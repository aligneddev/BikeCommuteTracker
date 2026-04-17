using System.Text;
using BikeTracking.Api.Infrastructure.Receipts;

namespace BikeTracking.Api.Tests.Expenses;

public sealed class ReceiptStorageTests
{
    [Fact]
    public async Task SaveAsync_StoresFileAndReturnsRelativePath()
    {
        await using var harness = new ReceiptStorageHarness();
        await using var content = new MemoryStream(Encoding.UTF8.GetBytes("receipt-content"));

        var relativePath = await harness.Storage.SaveAsync(12, 34, "receipt.pdf", content);

        Assert.StartsWith("12/34/", relativePath, StringComparison.Ordinal);
        Assert.EndsWith(".pdf", relativePath, StringComparison.OrdinalIgnoreCase);

        var savedPath = Path.Combine(
            harness.RootPath,
            relativePath.Replace('/', Path.DirectorySeparatorChar)
        );
        Assert.True(File.Exists(savedPath));
    }

    [Fact]
    public async Task GetAsync_ReturnsPreviouslySavedContent()
    {
        await using var harness = new ReceiptStorageHarness();
        await using var content = new MemoryStream(Encoding.UTF8.GetBytes("read-me"));
        var relativePath = await harness.Storage.SaveAsync(7, 8, "receipt.png", content);

        await using var stored = await harness.Storage.GetAsync(relativePath);
        using var reader = new StreamReader(stored, Encoding.UTF8);

        var payload = await reader.ReadToEndAsync();

        Assert.Equal("read-me", payload);
    }

    [Fact]
    public async Task DeleteAsync_RemovesPreviouslySavedFile()
    {
        await using var harness = new ReceiptStorageHarness();
        await using var content = new MemoryStream(Encoding.UTF8.GetBytes("delete-me"));
        var relativePath = await harness.Storage.SaveAsync(3, 4, "receipt.webp", content);

        await harness.Storage.DeleteAsync(relativePath);

        var savedPath = Path.Combine(
            harness.RootPath,
            relativePath.Replace('/', Path.DirectorySeparatorChar)
        );
        Assert.False(File.Exists(savedPath));
    }

    [Fact]
    public async Task GetAsync_RejectsPathTraversal()
    {
        await using var harness = new ReceiptStorageHarness();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            harness.Storage.GetAsync("../outside.txt")
        );
    }

    private sealed class ReceiptStorageHarness : IAsyncDisposable
    {
        public ReceiptStorageHarness()
        {
            RootPath = Path.Combine(Path.GetTempPath(), $"receipts-tests-{Guid.NewGuid():N}");
            Storage = new FileSystemReceiptStorage(RootPath);
        }

        public string RootPath { get; }

        public FileSystemReceiptStorage Storage { get; }

        public ValueTask DisposeAsync()
        {
            if (Directory.Exists(RootPath))
            {
                Directory.Delete(RootPath, recursive: true);
            }

            return ValueTask.CompletedTask;
        }
    }
}
