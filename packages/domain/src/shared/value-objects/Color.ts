import { Effect, Data } from "effect";

export class InvalidColor extends Data.TaggedError("InvalidColor")<{
    readonly reason: string
}> {}

export class Color {
    private constructor(readonly value: string) {}

    static make(value: string): Effect.Effect<Color, InvalidColor> {
        if(!/^#[0-9a-f]{6}$/i.test(value)) {
            return Effect.fail(new InvalidColor({reason: "Invalid color format, must be an Hexadecimal color code like #RRGGBB"}));
        }

        return Effect.succeed(new Color(value));
    }

    static fromTrusted(value: string): Color {
        return new Color(value);
    }

    equals(other: Color): boolean {
        return this.value === other.value;
    }
}