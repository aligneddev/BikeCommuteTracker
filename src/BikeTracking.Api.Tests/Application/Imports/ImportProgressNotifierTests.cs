using BikeTracking.Api.Application.Notifications;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace BikeTracking.Api.Tests.Application.Imports;

public sealed class ImportProgressNotifierTests
{
    [Fact]
    public async Task NotifyProgressAsync_SendsToRiderJobScopedGroup()
    {
        var hubContext = new FakeHubContext();
        var logger = new LoggerFactory().CreateLogger<ImportProgressNotifier>();
        var notifier = new ImportProgressNotifier(logger, hubContext);

        var payload = new ImportProgressNotification(
            RiderId: 11,
            ImportJobId: 99,
            Status: "processing",
            PercentComplete: 50,
            EtaMinutesRounded: 5,
            ProcessedRows: 25,
            TotalRows: 50,
            ImportedRows: 24,
            SkippedRows: 0,
            FailedRows: 1,
            EmittedAtUtc: DateTime.UtcNow
        );

        await notifier.NotifyProgressAsync(payload, CancellationToken.None);

        Assert.Equal(ImportProgressGroups.RiderJob(11, 99), hubContext.LastGroupName);
        Assert.Equal("import.progress", hubContext.LastMethodName);
        Assert.NotNull(hubContext.LastNotification);
        Assert.Equal(11, hubContext.LastNotification!.RiderId);
        Assert.Equal(99, hubContext.LastNotification.ImportJobId);
    }

    private sealed class FakeHubContext : IHubContext<ImportProgressHub>
    {
        private readonly FakeHubClients _clients;

        public FakeHubContext()
        {
            _clients = new FakeHubClients(this);
        }

        public string? LastGroupName { get; private set; }

        public string? LastMethodName { get; private set; }

        public ImportProgressNotification? LastNotification { get; private set; }

        public IHubClients Clients => _clients;

        public IGroupManager Groups => throw new NotSupportedException();

        private sealed class FakeHubClients(FakeHubContext owner) : IHubClients
        {
            private readonly FakeHubContext _owner = owner;

            public IClientProxy All => throw new NotSupportedException();

            public IClientProxy AllExcept(IReadOnlyList<string> excludedConnectionIds) =>
                throw new NotSupportedException();

            public IClientProxy Client(string connectionId) => throw new NotSupportedException();

            public IClientProxy Clients(IReadOnlyList<string> connectionIds) =>
                throw new NotSupportedException();

            public IClientProxy Group(string groupName)
            {
                _owner.LastGroupName = groupName;
                return new FakeClientProxy(_owner);
            }

            public IClientProxy GroupExcept(
                string groupName,
                IReadOnlyList<string> excludedConnectionIds
            ) => throw new NotSupportedException();

            public IClientProxy Groups(IReadOnlyList<string> groupNames) =>
                throw new NotSupportedException();

            public IClientProxy User(string userId) => throw new NotSupportedException();

            public IClientProxy Users(IReadOnlyList<string> userIds) =>
                throw new NotSupportedException();
        }

        private sealed class FakeClientProxy(FakeHubContext owner) : IClientProxy
        {
            private readonly FakeHubContext _owner = owner;

            public Task SendCoreAsync(
                string method,
                object?[] args,
                CancellationToken cancellationToken = default
            )
            {
                _owner.LastMethodName = method;
                _owner.LastNotification = args.OfType<ImportProgressNotification>()
                    .SingleOrDefault();
                return Task.CompletedTask;
            }
        }
    }
}
