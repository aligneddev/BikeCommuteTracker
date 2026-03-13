using Microsoft.Extensions.Options;

namespace BikeTracking.Api.Application.Users;

public sealed class PinPolicyValidator(IOptions<IdentityOptions> options)
{
    private readonly PinPolicyOptions _pinPolicy = options.Value.PinPolicy;

    public IReadOnlyList<string> Validate(string? pin)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(pin))
        {
            errors.Add("PIN is required.");
            return errors;
        }

        if (pin.Length < _pinPolicy.MinLength || pin.Length > _pinPolicy.MaxLength)
        {
            errors.Add($"PIN must be between {_pinPolicy.MinLength} and {_pinPolicy.MaxLength} characters.");
        }

        if (_pinPolicy.NumericOnly && pin.Any(ch => !char.IsDigit(ch)))
        {
            errors.Add("PIN must contain only numeric characters.");
        }

        return errors;
    }

    public static string? ValidateName(string? name)
    {
        var canonicalName = name?.Trim();
        return string.IsNullOrWhiteSpace(canonicalName) ? "Name is required." : null;
    }
}
