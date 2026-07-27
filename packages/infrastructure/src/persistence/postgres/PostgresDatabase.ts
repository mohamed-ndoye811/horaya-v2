import { Context, Layer, Effect } from "effect"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { AppConfig } from "../../config/ConfigLive"
import * as schema from "./schema"

export type Database = ReturnType<typeof drizzle<typeof schema>>

export class PostgresDatabase extends Context.Tag("Database")<PostgresDatabase, Database>() {}

export const PostgresDatabaseLayer = Layer.scoped(
  PostgresDatabase,
  Effect.gen(function* () {
    const config = yield* AppConfig
    
    // Créer la connexion postgres
    const connection = postgres(config.databaseUrl)
    
    // Créer l'instance Drizzle
    const db = drizzle(connection, { schema })
    
    // Cleanup lors de la fermeture
    yield* Effect.addFinalizer(() => Effect.promise(() => connection.end()))
    
    return db
  })
)
