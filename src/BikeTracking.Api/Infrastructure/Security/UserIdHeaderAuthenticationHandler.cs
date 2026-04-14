using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace BikeTracking.Api.Infrastructure.Security;

public sealed class UserIdHeaderAuthenticationSchemeOptions : AuthenticationSchemeOptions { }

public sealed class UserIdHeaderAuthenticationHandler
    : AuthenticationHandler<UserIdHeaderAuthenticationSchemeOptions>
{
    public const string SchemeName = "UserIdHeader";
    public const string UserIdHeaderName = "X-User-Id";

    public UserIdHeaderAuthenticationHandler(
        IOptionsMonitor<UserIdHeaderAuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder
    )
        : base(options, logger, encoder) { }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var userIdString = Request.Headers[UserIdHeaderName].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(userIdString))
        {
            // SignalR browser websocket connections cannot send custom headers,
            // so we allow the same user id value via access token query parameter.
            userIdString = Request.Query["access_token"].FirstOrDefault();
        }
        if (string.IsNullOrWhiteSpace(userIdString))
        {
            userIdString = Request.Query["userId"].FirstOrDefault();
        }

        if (string.IsNullOrWhiteSpace(userIdString))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        if (!long.TryParse(userIdString, out var userId) || userId <= 0)
        {
            return Task.FromResult(AuthenticateResult.Fail("Invalid X-User-Id header."));
        }

        var claims = new[] { new Claim("sub", userId.ToString()) };
        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, SchemeName);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
