namespace BikeTracking.Domain.FSharp.Expenses

open System

module ExpenseEvents =
    type ExpenseRecordedData = {
        ExpenseId: int64
        RiderId: int64
        ExpenseDate: DateTime
        Amount: decimal
        Notes: string option
        ReceiptPath: string option
        RecordedAt: DateTime
    }

    type ExpenseEditedData = {
        ExpenseId: int64
        RiderId: int64
        ExpenseDate: DateTime
        Amount: decimal
        Notes: string option
        ReceiptPath: string option
        ExpectedVersion: int
        EditedAt: DateTime
    }

    type ExpenseDeletedData = {
        ExpenseId: int64
        RiderId: int64
        DeletedAt: DateTime
    }

    type ExpenseEvent =
        | ExpenseRecorded of ExpenseRecordedData
        | ExpenseEdited of ExpenseEditedData
        | ExpenseDeleted of ExpenseDeletedData

    let validateAmount (amount: decimal) : Result<decimal, string> =
        if amount > 0m then
            Ok amount
        else
            Error "Expense amount must be greater than zero"

    let validateNotes (notes: string option) : Result<string option, string> =
        match notes with
        | None -> Ok None
        | Some value when value.Length > 500 -> Error "Note must be 500 characters or fewer"
        | Some value -> Ok (Some value)

    let validateDate (expenseDate: DateTime) : Result<DateTime, string> =
        if expenseDate = DateTime.MinValue then
            Error "Expense date is required"
        else
            Ok expenseDate
