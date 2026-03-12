var builder = DistributedApplication.CreateBuilder(args);

var apiService = builder
    .AddProject<Projects.BikeTracking_Api>("api")
    .WithHttpHealthCheck("/health")
    .WithExternalHttpEndpoints();

// AddViteApp was not working with Aurelia
var webFrontend = builder
    .AddNodeApp("frontend", "../BikeTracking.Frontend", "node_modules/vite/bin/vite.js")
    .WithNpm()
    .WithRunScript("preview")
    .WithHttpEndpoint(port: 5173, env: "PORT")
    .WithReference(apiService)
    .WaitFor(apiService);

apiService.PublishWithContainerFiles(webFrontend, "wwwroot");

builder.Build().Run();
