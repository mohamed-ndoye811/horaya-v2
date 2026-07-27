import { Effect, Data } from "effect";

export class InvalidEventTypeId extends Data.TaggedError("InvalidEventId")<{
    readonly value: string
}> {}

export class EventTypeId {
    private constructor(readonly value: string) {}

    static make(value: string): Effect.Effect<EventTypeId, InvalidEventTypeId> {
        if(!/^[0-9a-f-]{36}$/i.test(value)) {
            return Effect.fail(new InvalidEventTypeId({value}));
        }

        return Effect.succeed(new EventTypeId(value));
    }

    static fromTrusted(value: string): EventTypeId {
        return new EventTypeId(value);
    }

    equals(other: EventTypeId): boolean {
        return this.value === other.value;
    }
}