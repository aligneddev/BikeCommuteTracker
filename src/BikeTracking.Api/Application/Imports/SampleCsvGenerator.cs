using System.Text;

namespace BikeTracking.Api.Application.Imports;

public static class SampleCsvGenerator
{
    public static string Generate()
    {
        var sb = new StringBuilder();
        sb.AppendLine("# Sample CSV for bike ride import");
        sb.AppendLine("# Legend:");
        sb.AppendLine(
            "#   Date        - required. Supported formats: yyyy-MM-dd, MM/dd/yyyy, M/d/yyyy, dd-MMM-yyyy"
        );
        sb.AppendLine("#   Miles       - required. Decimal number 0.01-200");
        sb.AppendLine("#   Time        - optional. Ride duration in minutes (45) or HH:mm (00:45)");
        sb.AppendLine("#   Temp        - optional. Temperature in Fahrenheit (decimal)");
        sb.AppendLine("#   Notes       - optional. Max 500 characters");
        sb.AppendLine("#   Difficulty  - optional. Integer 1 (Very Easy) to 5 (Very Hard)");
        sb.AppendLine(
            "#   PrimaryTravelDirection (CSV header) - optional. Primary travel direction: North, NE, E, SE, S, SW, W, NW."
        );
        sb.AppendLine("Date,Miles,Time,Temp,Notes,Difficulty,PrimaryTravelDirection");
        sb.AppendLine("2026-01-15,12.5,45,38,\"Morning commute\",3,NE");
        sb.AppendLine("2026-01-16,12.5,43,41,,1,South");
        sb.AppendLine("2026-01-17,12.5,,35,\"Windy day\",5,North");
        sb.AppendLine("2026-01-18,8.0,32,42,\"Short route\",,");
        sb.AppendLine("2026-01-19,12.5,44,39,,2,SW");
        return sb.ToString();
    }
}
