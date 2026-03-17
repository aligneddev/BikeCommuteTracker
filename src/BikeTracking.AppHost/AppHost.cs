var builder = DistributedApplication.CreateBuilder(args);

// API logs include outbox worker diagnostics for user-registration event publishing.
// Check Aspire service logs for entries from OutboxPublisherService and UserRegisteredPublisher.
var apiService = builder
    .AddProject<Projects.BikeTracking_Api>("api")
    .WithHttpHealthCheck("/health")
    .WithExternalHttpEndpoints();

// AddViteApp was not working with Aurelia
var webFrontend = builder
    .AddNodeApp("frontend", "../BikeTracking.Frontend", "node_modules/vite/bin/vite.js")
    .WithNpm()
    .WithRunScript("preview")
    .WithHttpEndpoint(port: 4173, env: "PORT")
    .WithEnvironment("VITE_API_BASE_URL", "http://localhost:5436")
    .WithReference(apiService)
    .WaitFor(apiService);

apiService.PublishWithContainerFiles(webFrontend, "wwwroot");

builder.Build().Run();
