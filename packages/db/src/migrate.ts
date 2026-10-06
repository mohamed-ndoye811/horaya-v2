import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL manquant (voir .env.example)");
}

const client = postgres(databaseUrl, { max: 1 });
await migrate(drizzle(client), {
  migrationsFolder: new URL("../migrations", import.meta.url).pathname,
});
await client.end();
console.log("Migrations appliquées.");
