import { Effect, Data, Context } from "effect";
import { EventType } from "./EventType";
import { EventTypeId } from "./value-objects/EventTypeId";

export class EventTypeNotFound extends Data.TaggedError("EventTypeNotFound")<{
  readonly id: string;
}> {}

export class DbError extends Data.TaggedError("DbError")<{
  readonly cause: unknown;
}> {}

export class EventTypeRepository extends Context.Tag("EventTypeRepository")<
  EventTypeRepository,
  {
    readonly save: (eventType: EventType) => Effect.Effect<void, DbError>;
    readonly findById: (
      id: EventTypeId,
    ) => Effect.Effect<EventType, EventTypeNotFound | DbError>;
  }
>() {}
