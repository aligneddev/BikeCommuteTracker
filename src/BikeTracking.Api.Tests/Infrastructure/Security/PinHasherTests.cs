using BikeTracking.Api.Infrastructure.Security;
using BikeTracking.Api.Tests.TestSupport;

namespace BikeTracking.Api.Tests.Infrastructure.Security;

public sealed class PinHasherTests
{
    private readonly PinHasher _hasher = new(TestFactories.IdentityOptions());

    [Fact]
    public void Verify_ReturnsTrue_ForMatchingPin()
    {
        var hashed = _hasher.Hash("1234");

        var isMatch = _hasher.Verify("1234", hashed.Salt, hashed.Hash, hashed.Iterations);

        Assert.True(isMatch);
    }

    [Fact]
    public void Verify_ReturnsFalse_ForWrongPin()
    {
        var hashed = _hasher.Hash("1234");

        var isMatch = _hasher.Verify("9999", hashed.Salt, hashed.Hash, hashed.Iterations);

        Assert.False(isMatch);
    }

    [Fact]
    public void Hash_ProducesDifferentSaltAndHash_ForSamePinAcrossCalls()
    {
        var first = _hasher.Hash("1234");
        var second = _hasher.Hash("1234");

        Assert.False(first.Salt.SequenceEqual(second.Salt));
        Assert.False(first.Hash.SequenceEqual(second.Hash));
    }
}
