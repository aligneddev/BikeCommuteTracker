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
    .WithReference(apiService)
    .WaitFor(apiService);

apiService.PublishWithContainerFiles(webFrontend, "wwwroot");

builder.Build().Run();
