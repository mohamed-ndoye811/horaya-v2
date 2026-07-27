import { Effect, Data } from "effect";

export class InvalidTenantId extends Data.TaggedError("InvalidTenantId")<{
  readonly value: string;
}> {}

export class TenantId {
  private constructor(private readonly value: string) {}

  static make(value: string): Effect.Effect<TenantId, InvalidTenantId> {
    if(!/^[0-9a-f-]{36}$/i.test(value)) {
      return Effect.fail(new InvalidTenantId({value}));

    }
    return Effect.succeed(new TenantId(value));
  }

  static fromTrusted(value: string): TenantId {
    return new TenantId(value);
  }

  equals(other: TenantId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}