using System.Security.Claims;

namespace BikeTracking.Api.Application.Notifications;

public static class ImportProgressHubAuth
{
    public static bool TryGetRiderId(ClaimsPrincipal user, out long riderId)
    {
        riderId = default;
        var riderClaim = user.FindFirst("sub")?.Value;
        return long.TryParse(riderClaim, out riderId) && riderId > 0;
    }
}
