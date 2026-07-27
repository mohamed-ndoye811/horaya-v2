import { Effect, Layer } from "effect"
import { PostgresDatabase } from "../PostgresDatabase"
import { DbError, EventTypeNotFound, EventTypeRepository } from "@horaya/domain/event-type/EventTypeRepository"
import { EventTypePostgresMapper } from "../mappers/EventTypeMapper"
import { eventTypes } from "../schema"
import { eq } from "drizzle-orm"

export const EventTypePostgresRepository = Layer.effect(
  EventTypeRepository,
  Effect.gen(function* () {
    const db = yield* PostgresDatabase

    return EventTypeRepository.of({
      save: (eventType) =>
        Effect.tryPromise({
          try: () => db.insert(eventTypes)
            .values(EventTypePostgresMapper.toPersistence(eventType))
            .execute(),
          catch: (cause) => new DbError({ cause }),
        }).pipe(Effect.asVoid),

      findById: (id) =>
        Effect.tryPromise({
          try: () => db.select()
            .from(eventTypes)
            .where(eq(eventTypes.id, id.value))
            .limit(1)
            .execute()
            .then(rows => rows[0]),
          catch: (cause) => new DbError({ cause }),
        }).pipe(
          Effect.flatMap((row) =>
            row
              ? Effect.succeed(EventTypePostgresMapper.toDomain(row))
              : Effect.fail(new EventTypeNotFound({ id: id.value })),
          ),
        ),
    })
  })
)
