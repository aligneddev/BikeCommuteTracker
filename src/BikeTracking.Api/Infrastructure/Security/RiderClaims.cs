using System.Security.Claims;

namespace BikeTracking.Api.Infrastructure.Security;

public static class RiderClaims
{
    public const string RiderIdClaimType = "sub";

    /// <summary>
    /// Reads the rider id that <see cref="UserIdHeaderAuthenticationHandler"/> stores on the
    /// authenticated principal. Returns false when the claim is missing or not a positive id.
    /// </summary>
    public static bool TryGetRiderId(this ClaimsPrincipal user, out long riderId)
    {
        var riderIdValue = user.FindFirst(RiderIdClaimType)?.Value;
        return long.TryParse(riderIdValue, out riderId) && riderId > 0;
    }
}
