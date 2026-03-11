var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

var app = builder.Build();

app.MapGet("/", () => Results.Ok(new { message = "Bike Tracking API is running." }));
app.MapGet("/hello", () => Results.Ok(new { message = "Hello from Bike Tracking API." }));

app.MapDefaultEndpoints();

app.Run();
