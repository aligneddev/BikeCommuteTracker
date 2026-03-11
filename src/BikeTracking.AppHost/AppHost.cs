var builder = DistributedApplication.CreateBuilder(args);

var apiService = builder.AddProject<Projects.BikeTracking_Api>("api")
    .WithHttpHealthCheck("/health")
    .WithExternalHttpEndpoints();

var webFrontend = builder.AddViteApp("frontend", "../BikeTracking.Frontend")
    .WithReference(apiService)
    .WaitFor(apiService);

apiService.PublishWithContainerFiles(webFrontend, "wwwroot");

builder.Build().Run();
