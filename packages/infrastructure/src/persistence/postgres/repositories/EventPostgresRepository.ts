import { Effect, Layer } from "effect";
import {
  EventRepository,
  EventNotFound,
  DbError,
  EventsNotFound,
} from "@horaya/domain/event/EventRepository";
import { PostgresDatabase } from "../PostgresDatabase";
import { EventPostgresMapper } from "../mappers/EventPostgresMapper";
import { events } from "../schema";
import { eq } from "drizzle-orm";

export const EventPostgresRepository = Layer.effect(
  EventRepository,
  Effect.gen(function* () {
    const db = yield* PostgresDatabase;

    return EventRepository.of({
      save: (event) =>
        Effect.tryPromise({
          try: () =>
            db
              .insert(events)
              .values(EventPostgresMapper.toPersistence(event))
              .execute(),
          catch: (cause) => new DbError({ cause }),
        }).pipe(Effect.asVoid),

      findById: (id) =>
        Effect.tryPromise({
          try: () =>
            db
              .select()
              .from(events)
              .where(eq(events.id, id.value))
              .limit(1)
              .execute()
              .then((rows) => rows[0]),
          catch: (cause) => new DbError({ cause }),
        }).pipe(
          Effect.flatMap((row) =>
            row
              ? Effect.succeed(EventPostgresMapper.toDomain(row))
              : Effect.fail(new EventNotFound({ id: id.value })),
          ),
        ),

      listEvents: () =>
        Effect.tryPromise({
          try: () =>
            db
              .select()
              .from(events)
              .execute(),
          catch: (cause) => new DbError({ cause }),
        }).pipe(
          Effect.flatMap((rows) =>
            rows.length > 0
              ? Effect.succeed(rows.map((row) => EventPostgresMapper.toDomain(row)))
              : Effect.fail(new EventsNotFound({ message: "No events found" })),
          ),
        ),
      listEventsByTenantId: (tenantId) =>
        Effect.tryPromise({
          try: () =>
            db
              .select()
              .from(events)
              .where(eq(events.tenantId, tenantId))
              .execute(),
          catch: (cause) => new DbError({ cause }),
        }).pipe(
          Effect.flatMap((rows) =>
            rows.length > 0
              ? Effect.succeed(rows.map((row) => EventPostgresMapper.toDomain(row)))
              : Effect.fail(new EventsNotFound({ message: "No events found for the given tenant ID" })),
          ),
        ),
    });
  }),
);
