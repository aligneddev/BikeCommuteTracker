module BikeTracking.Domain.FSharp.AdvancedDashboardCalculations

open System

/// Lightweight snapshot of a single ride used for pure calculations.
type RideSnapshot =
    { Miles: decimal
      SnapshotAverageCarMpg: decimal option
      SnapshotMileageRateCents: decimal option
      /// Known gas price recorded at ride time; None = fallback was used.
      GasPricePerGallon: decimal option
      /// Resolved effective gas price (known or fallback).
      EffectiveGasPricePerGallon: decimal option
      RideDate: DateTime }

/// Calculates total gallons saved across a set of rides.
/// Returns None when no rides have a valid MPG snapshot.
let calculateGallonsSaved (rides: RideSnapshot list) : decimal option =
    let qualifiedRides =
        rides
        |> List.choose (fun r ->
            match r.SnapshotAverageCarMpg with
            | Some mpg when mpg > 0m -> Some(r.Miles / mpg)
            | _ -> None)

    match qualifiedRides with
    | [] -> None
    | gallons -> Some(gallons |> List.sum |> fun v -> Math.Round(v, 2, MidpointRounding.AwayFromZero))

/// Calculates total fuel cost avoided and whether any fallback prices were used.
/// Returns (value option * estimatedFlag).
let calculateFuelCostAvoided (rides: RideSnapshot list) : decimal option * bool =
    let mutable total = 0m
    let mutable hasValue = false
    let mutable estimated = false

    for ride in rides do
        match ride.SnapshotAverageCarMpg, ride.EffectiveGasPricePerGallon with
        | Some mpg, Some gasPrice when mpg > 0m ->
            total <- total + (ride.Miles / mpg * gasPrice)
            hasValue <- true

            if ride.GasPricePerGallon.IsNone then
                estimated <- true
        | _ -> ()

    if hasValue then
        (Some(Math.Round(total, 2, MidpointRounding.AwayFromZero)), estimated)
    else
        (None, false)

/// Calculates total mileage-rate savings across a set of rides.
/// Returns None when no rides have a valid mileage rate snapshot.
let calculateMileageRateSavings (rides: RideSnapshot list) : decimal option =
    let qualifiedRides =
        rides
        |> List.choose (fun r ->
            match r.SnapshotMileageRateCents with
            | Some rateCents -> Some(r.Miles * rateCents / 100m)
            | None -> None)

    match qualifiedRides with
    | [] -> None
    | savings ->
        Some(savings |> List.sum |> fun v -> Math.Round(v, 2, MidpointRounding.AwayFromZero))
