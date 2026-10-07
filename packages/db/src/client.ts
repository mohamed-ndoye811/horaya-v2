import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(databaseUrl: string, options: { maxConnections?: number } = {}) {
  const client = postgres(databaseUrl, { max: options.maxConnections ?? 10 });
  return drizzle(client, { schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof createDb>;
/** Transaction Drizzle ouverte par `db.transaction`. */
export type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Ce sur quoi un dépôt peut s'exécuter : la base, ou une transaction en cours. */
export type Executor = Db | DbTransaction;
