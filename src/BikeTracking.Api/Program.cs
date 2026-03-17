using BikeTracking.Api.Application.Events;
using BikeTracking.Api.Application.Users;
using BikeTracking.Api.Endpoints;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Security;
using Microsoft.AspNetCore.HttpLogging;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

var connectionString =
    builder.Configuration.GetConnectionString("BikeTracking")
    ?? "Data Source=biketracking.local.db";

builder.Services.Configure<IdentityOptions>(builder.Configuration.GetSection("Identity"));
builder.Services.AddDbContext<BikeTrackingDbContext>(options =>
    options.UseSqlite(connectionString)
);

builder.Services.AddScoped<PinPolicyValidator>();
builder.Services.AddSingleton<IPinHasher, PinHasher>();
builder.Services.AddScoped<SignupService>();
builder.Services.AddScoped<IdentifyService>();

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

var app = builder.Build();

await using (var scope = app.Services.CreateAsyncScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<BikeTrackingDbContext>();
    await dbContext.Database.MigrateAsync();
}

app.MapGet("/", () => Results.Ok(new { message = "Bike Tracking API is running." }));
app.UseHttpLogging();
app.MapUsersEndpoints();
app.MapDefaultEndpoints();

app.Run();
