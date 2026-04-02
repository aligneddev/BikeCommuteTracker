var builder = DistributedApplication.CreateBuilder(args);

// Local SQL Server database for development
// var database = builder.AddSqlServer("sql").AddDatabase("biketracking");
// TODO https://aspire.dev/integrations/databases/sqlite/sqlite-get-started/?lang=csharp
//var sqlite = builder.AddSqlite("biketracking.db").AddDatabase("biketracking");

// API logs include outbox worker diagnostics for user-registration event publishing.
// Check Aspire service logs for entries from OutboxPublisherService and UserRegisteredPublisher.
var apiService = builder
    .AddProject<Projects.BikeTracking_Api>("api")
    //.WithReference(database)
    .WithHttpHealthCheck("/health")
    .WithExternalHttpEndpoints();

var webFrontend = builder
    .AddViteApp("frontend", "../BikeTracking.Frontend")
    .WithEndpoint(
        "http",
        endpoint =>
        {
            endpoint.Port = 5173;
            endpoint.TargetPort = 5173;
            // Disabling the proxy means Aspire's dashboard will not track requests for the frontend application, and you must ensure the configured port (default 5173) does not conflict with other local Vite instances
            // Required for HMR to work with default Aspire proxy
            endpoint.IsProxied = false;
        }
    )
    .WithReference(apiService)
    .WaitFor(apiService);

apiService.PublishWithContainerFiles(webFrontend, "wwwroot");

builder.Build().Run();
