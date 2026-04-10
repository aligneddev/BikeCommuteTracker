var builder = DistributedApplication.CreateBuilder(args);

var openMeteoForecast = builder.AddExternalService(
    "open-meteo-forecast",
    "https://api.open-meteo.com/"
);
var openMeteoArchive = builder.AddExternalService(
    "open-meteo-archive",
    "https://archive-api.open-meteo.com/"
);
var eiaGasPrice = builder.AddExternalService("eia-gas-price", "https://api.eia.gov/");

const string eiaGasPriceBaseUrl = "https+http://eia-gas-price";
const string openMeteoForecastBaseUrl = "https+http://open-meteo-forecast";
const string openMeteoArchiveBaseUrl = "https+http://open-meteo-archive";

// Local SQL Server database for development
// var database = builder.AddSqlServer("sql").AddDatabase("biketracking");
// TODO https://aspire.dev/integrations/databases/sqlite/sqlite-get-started/?lang=csharp
//var sqlite = builder.AddSqlite("biketracking.db").AddDatabase("biketracking");

// API logs include outbox worker diagnostics for user-registration event publishing.
// Check Aspire service logs for entries from OutboxPublisherService and UserRegisteredPublisher.
var apiService = builder
    .AddProject<Projects.BikeTracking_Api>("api")
    //.WithReference(database)
    .WithReference(openMeteoForecast)
    .WithReference(openMeteoArchive)
    .WithReference(eiaGasPrice)
    .WithEnvironment("ExternalApis__EiaGasPriceBaseUrl", eiaGasPriceBaseUrl)
    .WithEnvironment("ExternalApis__OpenMeteoForecastBaseUrl", openMeteoForecastBaseUrl)
    .WithEnvironment("ExternalApis__OpenMeteoArchiveBaseUrl", openMeteoArchiveBaseUrl)
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
            //             After restart, the Aspire dashboard will show the frontend link pointing directly to http://localhost:5173 (no proxy). At that URL, the browser connects straight to the Vite dev server and the HMR WebSocket (ws://localhost:5173) will work correctly.

            // Why it won't work at the proxy port at all: Aspire's DCP proxy handles HTTP but does not upgrade connections to WebSockets, so the ws:// HMR handshake is silently dropped regardless of what HMR options you set on the Vite side.
            // Required for HMR to work with default Aspire proxy
            endpoint.IsProxied = false;
        }
    )
    .WithReference(apiService)
    .WaitFor(apiService);

if (builder.ExecutionContext.IsPublishMode)
{
    apiService.PublishWithContainerFiles(webFrontend, "wwwroot");
}

builder.Build().Run();
