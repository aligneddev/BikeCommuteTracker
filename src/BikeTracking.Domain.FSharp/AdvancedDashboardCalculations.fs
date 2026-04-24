module BikeTracking.Domain.FSharp.AdvancedDashboardCalculations

open System
open System.Globalization

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

/// Lightweight snapshot of a single ride used for difficulty analytics.
type RideDifficultySnapshot(
    RideDate: DateTime,
    Difficulty: int option,
    WindResistanceRating: int option,
    WindSpeedMph: decimal option,
    PrimaryTravelDirection: string option,
    WindDirectionDeg: int option
) =
    member _.RideDate = RideDate
    member _.Difficulty = Difficulty
    member _.WindResistanceRating = WindResistanceRating
    member _.WindSpeedMph = WindSpeedMph
    member _.PrimaryTravelDirection = PrimaryTravelDirection
    member _.WindDirectionDeg = WindDirectionDeg

/// Result for difficulty aggregated by calendar month.
type DifficultyByMonthResult =
    { MonthNumber: int
      MonthName: string
      AverageDifficulty: decimal
      RideCount: int }

/// Bin for wind resistance distribution histogram.
type WindResistanceBin =
    { Rating: int
      RideCount: int }

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

/// Resolves an effective difficulty for a snapshot.
/// Priority: stored Difficulty → WindResistanceRating mapped to scale → wind data computed.
let resolveDifficulty (snapshot: RideDifficultySnapshot) : int option =
    match snapshot.Difficulty with
    | Some d -> Some d
    | None ->
        match snapshot.WindResistanceRating with
        | Some rating -> Some(WindResistance.resistanceToDifficulty rating)
        | None ->
            match snapshot.WindSpeedMph, snapshot.PrimaryTravelDirection, snapshot.WindDirectionDeg with
            | Some mph, Some dirStr, Some deg ->
                match WindResistance.tryParseCompassDirection dirStr with
                | Some dir ->
                    match WindResistance.calculateResistance mph dir deg with
                    | Ok rating -> Some(WindResistance.resistanceToDifficulty rating)
                    | Error _ -> None
                | None -> None
            | _ -> None

/// Calculates the overall average difficulty across all snapshots.
/// Returns None when no snapshots have a resolvable difficulty.
let calculateOverallAverageDifficulty (snapshots: RideDifficultySnapshot list) : decimal option =
    let resolved = snapshots |> List.choose resolveDifficulty

    match resolved with
    | [] -> None
    | values ->
        let sum = values |> List.sumBy decimal
        let avg = sum / decimal (List.length values)
        Some(Math.Round(avg, 1, MidpointRounding.AwayFromZero))

/// Calculates average difficulty grouped by calendar month (aggregated across all years).
/// Returns results sorted by month number ascending.
let calculateDifficultyByMonth (snapshots: RideDifficultySnapshot list) : DifficultyByMonthResult seq =
    snapshots
    |> List.choose (fun s ->
        match resolveDifficulty s with
        | Some d -> Some(s.RideDate.Month, d)
        | None -> None)
    |> List.groupBy fst
    |> List.map (fun (month, items) ->
        let difficulties = items |> List.map snd
        let sum = difficulties |> List.sumBy decimal
        let avg = sum / decimal (List.length difficulties)
        { MonthNumber = month
          MonthName = CultureInfo.InvariantCulture.DateTimeFormat.GetMonthName(month)
          AverageDifficulty = Math.Round(avg, 1, MidpointRounding.AwayFromZero)
          RideCount = List.length difficulties })
    |> List.sortBy (fun r -> r.MonthNumber)
    |> Seq.ofList

/// Calculates wind resistance rating distribution as a histogram with 9 bins (−4 to +4).
/// Only counts rides that have a stored WindResistanceRating.
let calculateWindResistanceDistribution (snapshots: RideDifficultySnapshot list) : WindResistanceBin seq =
    let countByRating =
        snapshots
        |> List.choose (fun s -> s.WindResistanceRating)
        |> List.groupBy id
        |> List.map (fun (rating, items) -> (rating, List.length items))
        |> dict

    seq {
        for rating in -4 .. 4 do
            let count =
                match countByRating.TryGetValue rating with
                | true, c -> c
                | false, _ -> 0

            yield { Rating = rating; RideCount = count }
    }
