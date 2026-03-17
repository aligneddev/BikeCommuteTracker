namespace BikeTracking.Api.Application.Users;

public static class UserNameNormalizer
{
    public static string Normalize(string name)
    {
        ArgumentException.ThrowIfNullOrEmpty(name);
        return name.Trim().ToUpperInvariant();
    }

    public static string CanonicalDisplayName(string name)
    {
        ArgumentException.ThrowIfNullOrEmpty(name);
        return name.Trim();
    }
}
