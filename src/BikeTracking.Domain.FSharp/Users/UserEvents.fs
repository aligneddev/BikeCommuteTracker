namespace BikeTracking.Domain.FSharp.Users

open System

type UserRegisteredEvent = {
    EventId: Guid
    UserId: int64
    UserName: string
    OccurredAtUtc: DateTime
    Source: string
}

module UserEventMapping =
    let createUserRegistered eventId userId userName occurredAtUtc source =
        {
            EventId = eventId
            UserId = userId
            UserName = userName
            OccurredAtUtc = occurredAtUtc
            Source = source
        }
