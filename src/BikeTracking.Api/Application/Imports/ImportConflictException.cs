namespace BikeTracking.Api.Application.Imports;

public sealed class ImportConflictException(string message) : Exception(message);
