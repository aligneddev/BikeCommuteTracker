module BikeTracking.Domain.FSharp.WindResistance

open System

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

/// Eight-point compass rose direction for rider travel or wind source.
type CompassDirection =
    | North
    | NE
    | East
    | SE
    | South
    | SW
    | West
    | NW

/// Errors that can occur during wind resistance calculation.
type WindResistanceError =
    | InvalidWindDirection of message: string
    | InvalidWindSpeed of message: string

// ──────────────────────────────────────────────────────────────
// Primitive helpers (pure, no I/O)
// ──────────────────────────────────────────────────────────────

/// Converts a meteorological wind-from bearing (0–360°) to an 8-point compass direction.
/// Uses 22.5° bin boundaries centred on each cardinal/intercardinal point.
/// Returns Error when degrees is outside [0, 360].
let degreesToCompass (degrees: int) : Result<CompassDirection, WindResistanceError> =
    if degrees < 0 || degrees > 360 then
        Error(InvalidWindDirection $"Wind direction must be 0–360°, received {degrees}")
    else
        let sector = (degrees + 22) % 360 / 45
        let directions = [| North; NE; East; SE; South; SW; West; NW |]
        Ok directions.[sector]

/// Returns the canonical bearing (degrees) for a given compass direction.
let compassToDegrees (direction: CompassDirection) : int =
    match direction with
    | North -> 0
    | NE -> 45
    | East -> 90
    | SE -> 135
    | South -> 180
    | SW -> 225
    | West -> 270
    | NW -> 315

/// Computes the angular difference between two bearings, returning the shorter arc in [0, 180].
let shorterArc (bearing1: int) (bearing2: int) : int =
    let diff = abs (bearing1 - bearing2)
    if diff > 180 then 360 - diff else diff

// ──────────────────────────────────────────────────────────────
// Core calculations (pure, no I/O)
// ──────────────────────────────────────────────────────────────

/// Calculates wind resistance rating (−4 to +4) from wind speed and direction.
///
/// Formula: resistance = clamp(round(windSpeedMph × cos(angle) / 5), −4, +4)
/// Positive = headwind (harder); Negative = tailwind (easier).
///
/// Threshold: 5 mph — so a 20 mph direct headwind produces exactly +4.
/// Returns Error for invalid inputs.
let calculateResistance
    (windSpeedMph: decimal)
    (travelDirection: CompassDirection)
    (windFromDeg: int)
    : Result<int, WindResistanceError> =
    if windSpeedMph < 0m then
        Error(InvalidWindSpeed $"Wind speed cannot be negative: {windSpeedMph}")
    elif windFromDeg < 0 || windFromDeg > 360 then
        Error(InvalidWindDirection $"Wind direction must be 0–360°, received {windFromDeg}")
    else
        let travelDeg = compassToDegrees travelDirection
        let angleDeg = shorterArc travelDeg windFromDeg
        let angleRad = float angleDeg * Math.PI / 180.0
        let cosAngle = Math.Cos angleRad
        let raw = float windSpeedMph * cosAngle / 5.0
        let rounded = int (Math.Round(raw, MidpointRounding.AwayFromZero))
        Ok(Math.Clamp(rounded, -4, 4))

/// Maps a wind resistance rating (−4 to +4) to the rider difficulty scale (1–5).
///
/// Mapping:
///   ≤ −3  →  1 (Very Easy)
///   −2/−1 →  2 (Easy)
///   0     →  3 (Moderate)
///   +1/+2 →  4 (Hard)
///   ≥ +3  →  5 (Very Hard)
let resistanceToDifficulty (resistance: int) : int =
    if resistance <= -3 then 1
    elif resistance = -2 || resistance = -1 then 2
    elif resistance = 0 then 3
    elif resistance = 1 || resistance = 2 then 4
    else 5

/// Main entry point: calculates (windResistanceRating, suggestedDifficulty) for a ride.
///
/// Special rule FR-012: when windSpeedMph is None or 0, returns (0, 1) without invoking
/// the formula (calm conditions = no resistance, very easy difficulty).
///
/// Returns (0, 1) when wind direction is unavailable (cannot calculate without direction).
let calculateDifficulty
    (windSpeedMph: decimal option)
    (travelDirection: CompassDirection)
    (windFromDeg: int option)
    : Result<int * int, WindResistanceError> =
    match windSpeedMph, windFromDeg with
    | None, _ -> Ok(0, 1)
    | Some 0m, _ -> Ok(0, 1)
    | _, None -> Ok(0, 1)
    | Some speed, Some deg ->
        calculateResistance speed travelDirection deg
        |> Result.map (fun r -> (r, resistanceToDifficulty r))

// ──────────────────────────────────────────────────────────────
// Parsing helpers (used by C# API layer)
// ──────────────────────────────────────────────────────────────

/// Parses a compass direction string (case-insensitive) to CompassDirection.
/// Accepts: "North", "NE", "NW", "South", "SE", "SW", "East", "West".
let tryParseCompassDirection (s: string) : CompassDirection option =
    match s.Trim().ToUpperInvariant() with
    | "NORTH" -> Some North
    | "NE" -> Some NE
    | "EAST" -> Some East
    | "SE" -> Some SE
    | "SOUTH" -> Some South
    | "SW" -> Some SW
    | "WEST" -> Some West
    | "NW" -> Some NW
    | _ -> None

/// All valid direction strings for validation messages.
let validDirectionNames : string list =
    [ "North"; "NE"; "East"; "SE"; "South"; "SW"; "West"; "NW" ]
