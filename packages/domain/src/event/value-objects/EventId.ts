import { Effect, Data } from "effect";

export class InvalidEventId extends Data.TaggedError("InvalidEventId")<{
    readonly value: string
}> {}

export class EventId {
    private constructor(readonly value: string) {}

    static make(value: string): Effect.Effect<EventId, InvalidEventId> {
        if(!/^[0-9a-f-]{36}$/i.test(value)) {
            return Effect.fail(new InvalidEventId({value}));
        }

        return Effect.succeed(new EventId(value));
    }

    static fromTrusted(value: string): EventId {
        return new EventId(value);
    }

    equals(other: EventId): boolean {
        return this.value === other.value;
    }
}