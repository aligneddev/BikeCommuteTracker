using BikeTracking.Api.Application.Dashboard;
using BikeTracking.Api.Application.Events;
using BikeTracking.Api.Application.Imports;
using BikeTracking.Api.Application.Notifications;
using BikeTracking.Api.Application.Rides;
using BikeTracking.Api.Application.Users;
using BikeTracking.Api.Endpoints;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Security;
using Microsoft.AspNetCore.HttpLogging;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

var connectionString =
    builder.Configuration.GetConnectionString("BikeTracking")
    ?? "Data Source=biketracking.local.db";
var eiaGasPriceBaseUrl =
    builder.Configuration["ExternalApis:EiaGasPriceBaseUrl"] ?? "https+http://eia-gas-price";
var openMeteoForecastBaseUrl =
    builder.Configuration["ExternalApis:OpenMeteoForecastBaseUrl"]
    ?? "https+http://open-meteo-forecast";
var openMeteoArchiveBaseUrl =
    builder.Configuration["ExternalApis:OpenMeteoArchiveBaseUrl"]
    ?? "https+http://open-meteo-archive";

builder.Services.Configure<IdentityOptions>(builder.Configuration.GetSection("Identity"));
builder.Services.AddDbContext<BikeTrackingDbContext>(options =>
    options.UseSqlite(connectionString)
);

builder.Services.AddScoped<PinPolicyValidator>();
builder.Services.AddSingleton<IPinHasher, PinHasher>();
builder.Services.AddScoped<SignupService>();
builder.Services.AddScoped<IdentifyService>();
builder.Services.AddScoped<UserSettingsService>();
builder.Services.AddScoped<GetDashboardService>();

builder
    .Services.AddAuthentication(UserIdHeaderAuthenticationHandler.SchemeName)
    .AddScheme<UserIdHeaderAuthenticationSchemeOptions, UserIdHeaderAuthenticationHandler>(
        UserIdHeaderAuthenticationHandler.SchemeName,
        _ => { }
    );
builder.Services.AddAuthorization();

builder.Services.AddScoped<RecordRideService>();
builder.Services.AddScoped<GetRideDefaultsService>();
builder.Services.AddScoped<GetQuickRideOptionsService>();
builder.Services.AddScoped<GetRideHistoryService>();
builder.Services.AddScoped<EditRideService>();
builder.Services.AddScoped<DeleteRideService>();
builder.Services.AddScoped<ICsvRideImportService, CsvRideImportService>();
builder.Services.AddScoped<IDuplicateResolutionService, DuplicateResolutionService>();
builder.Services.AddScoped<IImportProgressNotifier, ImportProgressNotifier>();
builder.Services.AddScoped<IImportJobRepository, EfImportJobRepository>();
builder.Services.AddSingleton<IImportJobProcessor, ImportJobProcessor>();
builder.Services.AddScoped<IGasPriceLookupService, EiaGasPriceLookupService>();
builder.Services.AddScoped<IWeatherLookupService, OpenMeteoWeatherLookupService>();

builder.Services.AddHttpClient(
    "EiaGasPrice",
    client =>
    {
        client.BaseAddress = new Uri(eiaGasPriceBaseUrl);
        client.Timeout = TimeSpan.FromSeconds(10);
    }
);
builder.Services.AddHttpClient(
    "OpenMeteoForecast",
    client =>
    {
        client.BaseAddress = new Uri(openMeteoForecastBaseUrl);
        client.Timeout = TimeSpan.FromSeconds(5);
    }
);
builder.Services.AddHttpClient(
    "OpenMeteoArchive",
    client =>
    {
        client.BaseAddress = new Uri(openMeteoArchiveBaseUrl);
        client.Timeout = TimeSpan.FromSeconds(5);
    }
);

builder.Services.AddSingleton<IOutboxStore, EfOutboxStore>();
builder.Services.AddSingleton<IUserRegisteredPublisher, UserRegisteredPublisher>();
builder.Services.AddHostedService<OutboxPublisherService>();

builder.Services.AddHttpLogging(options =>
{
    // Keep request/response logging metadata-only to avoid credential leakage.
    options.LoggingFields =
        HttpLoggingFields.RequestMethod
        | HttpLoggingFields.RequestPath
        | HttpLoggingFields.ResponseStatusCode
        | HttpLoggingFields.Duration;
    options.RequestBodyLogLimit = 0;
    options.ResponseBodyLogLimit = 0;
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSignalR();

// Allow any localhost origin so the Vite dev server and published frontend
// can reach the API during local Aspire orchestration. The origin port varies
// per run so we match on host only, which is safe for local-only deployment.
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy
            .SetIsOriginAllowed(origin => new Uri(origin).Host == "localhost")
            .AllowAnyHeader()
            .AllowAnyMethod()
    );
});

var app = builder.Build();

if (Environment.GetEnvironmentVariable("PLAYWRIGHT_E2E") == "1")
{
    try
    {
        var sqliteBuilder = new SqliteConnectionStringBuilder(connectionString);
        var dataSource = sqliteBuilder.DataSource;
        if (!Path.IsPathRooted(dataSource))
        {
            dataSource = Path.GetFullPath(dataSource, AppContext.BaseDirectory);
        }

        app.Logger.LogInformation("Playwright E2E DB: {DataSource}", dataSource);
    }
    catch
    {
        app.Logger.LogInformation("Playwright E2E DB connection string configured.");
    }
}

await using (var scope = app.Services.CreateAsyncScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();

    await SqliteMigrationBootstrapper.ApplyCompatibilityWorkaroundsAsync(dbContext, app.Logger);

    await dbContext.Database.MigrateAsync();
}

app.MapGet("/", () => Results.Ok(new { message = "Bike Tracking API is running." }));
app.UseCors();
app.UseHttpLogging();
app.UseAuthentication();
app.UseAuthorization();
app.MapDashboardEndpoints();
app.MapUsersEndpoints();
app.MapRidesEndpoints();
app.MapImportEndpoints();
app.MapHub<ImportProgressHub>("/hubs/import-progress").RequireAuthorization();
app.MapDefaultEndpoints();

app.Run();
