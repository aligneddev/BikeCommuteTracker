using BikeTracking.Api.Application.Users;

namespace BikeTracking.Api.Tests.Application.Users;

public sealed class UserNameNormalizerTests
{
    [Fact]
    public void Normalize_TrimsAndUppercasesName()
    {
        var normalized = UserNameNormalizer.Normalize("  AlIce  ");

        Assert.Equal("ALICE", normalized);
    }

    [Fact]
    public void CanonicalDisplayName_TrimsNameWithoutChangingCase()
    {
        var canonical = UserNameNormalizer.CanonicalDisplayName("  AlIce  ");

        Assert.Equal("AlIce", canonical);
    }

    [Fact]
    public void Normalize_ThrowsForEmptyName()
    {
        Assert.Throws<ArgumentException>(() => UserNameNormalizer.Normalize(""));
    }
}
