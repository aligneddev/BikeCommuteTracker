using BikeTracking.Api.Application.Users;
using BikeTracking.Api.Tests.TestSupport;

namespace BikeTracking.Api.Tests.Application.Users;

public sealed class PinPolicyValidatorTests
{
    private readonly PinPolicyValidator _validator = new(
        TestFactories.IdentityOptions(options =>
        {
            options.PinPolicy.MinLength = 4;
            options.PinPolicy.MaxLength = 8;
            options.PinPolicy.NumericOnly = true;
        })
    );

    [Fact]
    public void Validate_ReturnsRequiredError_WhenPinMissing()
    {
        var errors = _validator.Validate("  ");

        Assert.Single(errors);
        Assert.Equal("PIN is required.", errors[0]);
    }

    [Fact]
    public void Validate_ReturnsLengthError_WhenPinTooShort()
    {
        var errors = _validator.Validate("123");

        Assert.Contains("PIN must be between 4 and 8 characters.", errors);
    }

    [Fact]
    public void Validate_ReturnsLengthError_WhenPinTooLong()
    {
        var errors = _validator.Validate("123456789");

        Assert.Contains("PIN must be between 4 and 8 characters.", errors);
    }

    [Fact]
    public void Validate_ReturnsNumericOnlyError_WhenPinHasNonDigits()
    {
        var errors = _validator.Validate("12ab");

        Assert.Contains("PIN must contain only numeric characters.", errors);
    }

    [Fact]
    public void Validate_ReturnsNoErrors_WhenPinIsValid()
    {
        var errors = _validator.Validate("1234");

        Assert.Empty(errors);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ValidateName_ReturnsRequiredMessage_ForBlankName(string? name)
    {
        var result = PinPolicyValidator.ValidateName(name);

        Assert.Equal("Name is required.", result);
    }

    [Fact]
    public void ValidateName_ReturnsNull_ForValidName()
    {
        var result = PinPolicyValidator.ValidateName(" Alice ");

        Assert.Null(result);
    }
}
