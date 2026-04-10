using Microsoft.AspNetCore.SignalR;

namespace BikeTracking.Api.Application.Notifications;

public static class ImportProgressGroups
{
    public static string RiderJob(long riderId, long importJobId) =>
        $"import-progress:rider:{riderId}:job:{importJobId}";
}

public sealed class ImportProgressHub : Hub
{
    public async Task SubscribeToImportJob(long importJobId)
    {
        var user = Context.User;
        if (user is null || !ImportProgressHubAuth.TryGetRiderId(user, out var riderId))
        {
            throw new HubException("Unauthorized rider context.");
        }

        await Groups.AddToGroupAsync(
            Context.ConnectionId,
            ImportProgressGroups.RiderJob(riderId, importJobId)
        );
    }

    public async Task UnsubscribeFromImportJob(long importJobId)
    {
        var user = Context.User;
        if (user is null || !ImportProgressHubAuth.TryGetRiderId(user, out var riderId))
        {
            throw new HubException("Unauthorized rider context.");
        }

        await Groups.RemoveFromGroupAsync(
            Context.ConnectionId,
            ImportProgressGroups.RiderJob(riderId, importJobId)
        );
    }
}
