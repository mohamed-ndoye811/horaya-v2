import { createDb, type Db } from "@horaya/db";
import { env } from "./env";

// Une seule connexion partagée, conservée entre deux rechargements à chaud en dev.
const globalForDb = globalThis as unknown as { horayaDb?: Db };

export const db = globalForDb.horayaDb ?? createDb(env.DATABASE_URL);
if (process.env.NODE_ENV !== "production") globalForDb.horayaDb = db;
