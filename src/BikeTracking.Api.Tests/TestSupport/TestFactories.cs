using BikeTracking.Api.Application.Users;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace BikeTracking.Api.Tests.TestSupport;

internal static class TestFactories
{
    public static IOptions<IdentityOptions> IdentityOptions(
        Action<IdentityOptions>? configure = null
    )
    {
        var options = new IdentityOptions();
        configure?.Invoke(options);
        return Options.Create(options);
    }

    public static BikeTrackingDbContext CreateDbContext(string? databaseName = null)
    {
        var options = new DbContextOptionsBuilder<BikeTrackingDbContext>()
            .UseInMemoryDatabase(databaseName ?? Guid.NewGuid().ToString())
            .Options;

        return new BikeTrackingDbContext(options);
    }
}

internal sealed class DelegatePinHasher(Func<string, bool> verifyPin) : IPinHasher
{
    public int VerifyCallCount { get; private set; }

    public PinHashResult Hash(string pin)
    {
        throw new NotSupportedException("Hash is not used in these tests.");
    }

    public bool Verify(string pin, byte[] salt, byte[] expectedHash, int iterations)
    {
        VerifyCallCount += 1;
        return verifyPin(pin);
    }
}
