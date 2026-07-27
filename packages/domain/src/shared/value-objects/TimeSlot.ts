import { Effect, Data } from "effect";

export class InvalidTimeSlot extends Data.TaggedError("InvalidTimeSlot")<{
    readonly reason: string;
}> {}

export class TimeSlot {
    private constructor(readonly start: Date, readonly end: Date) {}

    static make(start: Date, end: Date): Effect.Effect<TimeSlot, InvalidTimeSlot> {
        if (start >= end) {
            return Effect.fail(new InvalidTimeSlot({
                reason: "Start time must be before end time"
            }))
        }
        return Effect.succeed(new TimeSlot(start, end));
    }

    static fromTrusted(start: Date, end: Date): TimeSlot {
        return new TimeSlot(start, end);
    }

    equals(other: TimeSlot): boolean {
        return this.start.getTime() === other.start.getTime() && this.end.getTime() === other.end.getTime();
    }

    get durationInMinutes(): number {
        return (this.end.getTime() - this.start.getTime()) / 60000;
    }
}