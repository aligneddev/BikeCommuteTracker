namespace BikeTracking.Api.Application.Users;

public sealed class IdentityOptions
{
    public PinPolicyOptions PinPolicy { get; set; } = new();
    public HashingOptions Hashing { get; set; } = new();
    public ThrottleOptions Throttle { get; set; } = new();
}

public sealed class PinPolicyOptions
{
    public int MinLength { get; set; } = 4;
    public int MaxLength { get; set; } = 8;
    public bool NumericOnly { get; set; } = true;
}

public sealed class HashingOptions
{
    public string Algorithm { get; set; } = "PBKDF2-SHA256";
    public int Iterations { get; set; } = 10_000;
    public int SaltSizeBytes { get; set; } = 32;
    public int HashSizeBytes { get; set; } = 32;
    public int CredentialVersion { get; set; } = 1;
}

public sealed class ThrottleOptions
{
    public int[] StepsSeconds { get; set; } = [1, 2, 3, 5, 8, 15, 30];
    public int MaxSeconds { get; set; } = 30;
}
