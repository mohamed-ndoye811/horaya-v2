import { Effect, Context, Data } from "effect"
import { Event } from "./Event"
import { EventId } from "./value-objects/EventId"

export class EventNotFound extends Data.TaggedError("EventNotFound")<{
  readonly id: string
}> {}

export class EventsNotFound extends Data.TaggedError("EventsNotFound")<{
  readonly message: string
}> {}

export class DbError extends Data.TaggedError("DbError")<{
  readonly cause: unknown
}> {}

export class EventRepository extends Context.Tag("EventRepository")<
  EventRepository,
  {
    readonly save: (event: Event) => Effect.Effect<void, DbError>
    readonly findById: (id: EventId) => Effect.Effect<Event, EventNotFound | DbError>
    readonly listEvents: () => Effect.Effect<Event[], EventsNotFound | DbError>
    readonly listEventsByTenantId: (tenantId: string) => Effect.Effect<Event[], EventsNotFound | DbError>
  }
>() {}