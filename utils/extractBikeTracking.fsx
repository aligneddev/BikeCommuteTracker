
#r "nuget: ClosedXML"
#r "nuget: CsvHelper"


open System
open System.IO
open System.Globalization
open System.Text.RegularExpressions
open ClosedXML.Excel

type RideRecord =
    {
        Date : string
        Miles : string
        Time : string
        Temp : string
        Notes : string
        Difficulty : string
        PrimaryTravelDirection : string
    }

let normalizeTime (value:string) =
    if String.IsNullOrWhiteSpace value then
        ""
    else
        match value.Trim().ToLower() with
        | "am" -> "07:45"
        | "pm" -> "17:00"
        | _ -> value

let normalizeDate (worksheetYear:int) (value:obj) =

    try

        let dt =

            match value with
            | :? DateTime as d ->
                d

            | :? Double as serial ->
                DateTime.FromOADate(serial)

            | _ ->
                DateTime.Parse(value.ToString())

        DateTime(
            worksheetYear,
            dt.Month,
            dt.Day
        ).ToString("yyyy-MM-dd")

    with
    | _ -> ""

let extractDifficulty (text:string) =

    if String.IsNullOrWhiteSpace text then
        ""
    else

        let m =
            Regex.Match(
                text,
                @"\bW(-?\d+)\b",
                RegexOptions.IgnoreCase
            )

        if m.Success then
            if m.Groups.[1].Value.StartsWith("-") then
                "1"
            else if m.Groups.[1].Value = "0" then
                "1"
            else
                m.Groups.[1].Value
        else

            let t =
                text.ToLowerInvariant()

            if t.Contains("motor was essential") || t.Contains("w5") then
                "5"
            elif t.Contains("20-30 mph") || t.Contains("w5") then
                "5"
            elif t.Contains("very windy") || t.Contains("w4") then
                "4"
            elif t.Contains("windy!!") || t.Contains("w4") then
                "4"
            elif t.Contains("windy!") || t.Contains("w3") then
                "3"
            elif t.Contains("windy") || t.Contains("w2")|| t.Contains("w1") then
                "2"
            elif t.Contains("w0")|| t.Contains("W-") then
                "1"
            else
                ""

let extractDirection (text:string) =

    if String.IsNullOrWhiteSpace text then
        ""
    else

        let t = text.ToUpperInvariant()

        let patterns =
            [
                @"\bNORTH[\s-]*EAST\b", "NE"
                @"\bNORTH[\s-]*WEST\b", "NW"
                @"\bSOUTH[\s-]*EAST\b", "SE"
                @"\bSOUTH[\s-]*WEST\b", "SW"

                @"\bNE\b", "NE"
                @"\bNW\b", "NW"
                @"\bSE\b", "SE"
                @"\bSW\b", "SW"

                @"\bNORTH\b", "North"
                @"\bSOUTH\b", "South"
                @"\bEAST\b", "East"
                @"\bWEST\b", "West"

                @"\bN WIND\b", "North"
                @"\bS WIND\b", "South"
                @"\bE WIND\b", "East"
                @"\bW WIND\b", "West"
            ]

        patterns
        |> List.tryFind (fun (pattern,_) ->
            Regex.IsMatch(t,pattern))
        |> Option.map snd
        |> Option.defaultValue ""

let writeCsv (fileName:string) (records:RideRecord list) =

    use sw = new StreamWriter(fileName)

    sw.WriteLine(
        "Date,Miles,Time,Temp,Notes,Difficulty,PrimaryTravelDirection"
    )

    for r in records do

        let esc (s:string) =
            "\"" + s.Replace("\"","\"\"") + "\""

        sw.WriteLine(
            String.Join(
                ",",
                [
                    r.Date
                    r.Miles
                    r.Time
                    r.Temp
                    esc r.Notes
                    r.Difficulty
                    r.PrimaryTravelDirection
                ]
            )
        )

let processWorksheet (ws:IXLWorksheet) outputFolder =

    let year =
        Int32.Parse(ws.Name)

    let records =
        ResizeArray<RideRecord>()

    let rideCounter =
        Collections.Generic.Dictionary<string,int>()

    for row in ws.RowsUsed() do

        let dateCell =
            row.Cell(1)

        let date =
            normalizeDate year dateCell.Value

        if date <> "" then

            let count =
                if rideCounter.ContainsKey(date) then
                    rideCounter.[date] <- rideCounter.[date] + 1
                    rideCounter.[date]
                else
                    rideCounter.[date] <- 1
                    1

            let miles =
                row.Cell(2).GetString()

            let rawTime =
                row.Cell(3).GetString()

            let temp =
                row.Cell(4).GetString()

            let tags =
                row.Cell(5).GetString()

            let notes =
                row.Cell(6).GetString()

            let mergedNotes =

                [
                    tags
                    notes
                ]
                |> List.filter (
                    String.IsNullOrWhiteSpace
                    >> not
                )
                |> String.concat "; "

            let inferredTime =

                let t =
                    normalizeTime rawTime

                if String.IsNullOrWhiteSpace t then

                    match count with
                    | 1 -> "07:45"
                    | 2 -> "17:00"
                    | _ -> ""

                else
                    t

            records.Add
                {
                    Date = date
                    Miles = miles
                    Time = inferredTime
                    Temp = temp
                    Notes = mergedNotes
                    Difficulty =
                        extractDifficulty mergedNotes
                    PrimaryTravelDirection =
                        extractDirection mergedNotes
                }

    let outputFile =
        Path.Combine(
            outputFolder,
            $"{year}.csv"
        )

    writeCsv
        outputFile
        (records |> Seq.toList)

    printfn $"Created {outputFile}"

// [<EntryPoint>]
// let main argv =
let run () =
    let workbookPath =
        "../Bike Tracking.xlsx"

    let outputFolder =
        "output_csv"

    Directory.CreateDirectory(outputFolder)
    |> ignore

    use workbook =
        new XLWorkbook(workbookPath)

    workbook.Worksheets
    |> Seq.filter (fun ws ->
        Regex.IsMatch(
            ws.Name,
            @"^\d{4}$"
        ))
    |> Seq.iter (fun ws ->
        processWorksheet ws outputFolder)

    0

run()