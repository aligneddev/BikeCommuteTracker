using System.Security.Cryptography;
using BikeTracking.Api.Application.Users;
using Microsoft.Extensions.Options;

namespace BikeTracking.Api.Infrastructure.Security;

public interface IPinHasher
{
    PinHashResult Hash(string pin);
    bool Verify(string pin, byte[] salt, byte[] expectedHash, int iterations);
}

public readonly record struct PinHashResult(
    byte[] Hash,
    byte[] Salt,
    string Algorithm,
    int Iterations,
    int CredentialVersion
);

public sealed class PinHasher(IOptions<IdentityOptions> options) : IPinHasher
{
    private readonly HashingOptions _hashingOptions = options.Value.Hashing;

    public PinHashResult Hash(string pin)
    {
        var salt = RandomNumberGenerator.GetBytes(_hashingOptions.SaltSizeBytes);
        var hash = Rfc2898DeriveBytes.Pbkdf2(
            pin,
            salt,
            _hashingOptions.Iterations,
            HashAlgorithmName.SHA256,
            _hashingOptions.HashSizeBytes
        );

        return new PinHashResult(
            hash,
            salt,
            _hashingOptions.Algorithm,
            _hashingOptions.Iterations,
            _hashingOptions.CredentialVersion
        );
    }

    public bool Verify(string pin, byte[] salt, byte[] expectedHash, int iterations)
    {
        var computedHash = Rfc2898DeriveBytes.Pbkdf2(
            pin,
            salt,
            iterations,
            HashAlgorithmName.SHA256,
            expectedHash.Length
        );

        return CryptographicOperations.FixedTimeEquals(computedHash, expectedHash);
    }
}
