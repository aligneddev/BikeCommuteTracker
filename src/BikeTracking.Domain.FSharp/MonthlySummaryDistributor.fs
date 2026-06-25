module BikeTracking.Domain.FSharp.MonthlySummaryDistributor

open System

let getWeekdays (month: int) (year: int) : DateOnly list =
    let daysInMonth = DateTime.DaysInMonth(year, month)

    [ 1 .. daysInMonth ]
    |> List.map (fun day -> DateOnly(year, month, day))
    |> List.filter (fun date ->
        match date.DayOfWeek with
        | DayOfWeek.Saturday
        | DayOfWeek.Sunday -> false
        | _ -> true)

let selectWeekdays (weekdays: DateOnly list) (days: int) : Result<DateOnly list, string> =
    if days < 1 then
        Error "Days must be at least 1."
    elif days > List.length weekdays then
        Error $"Days ({days}) exceeds available weekdays ({List.length weekdays})."
    else
        let stride = max 1 (List.length weekdays / days)

        let selected =
            [ 1 .. days ]
            |> List.map (fun index -> weekdays.[index * stride - 1])

        Ok selected

let distributeRides
    (month: int)
    (year: int)
    (totalMiles: decimal)
    (days: int)
    : Result<(DateOnly * decimal) list, string> =
    if days < 1 then
        Error "Days must be at least 1."
    else
        let weekdays = getWeekdays month year

        match selectWeekdays weekdays days with
        | Error error -> Error error
        | Ok selected ->
            let perDay = Math.Floor(totalMiles / decimal days * 100m) / 100m
            let remainder = totalMiles - (perDay * decimal days)

            let rides =
                selected
                |> List.mapi (fun index date ->
                    if index = List.length selected - 1 then
                        date, perDay + remainder
                    else
                        date, perDay)

            Ok rides
