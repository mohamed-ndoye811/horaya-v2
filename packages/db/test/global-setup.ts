import { loadEnvFile } from "node:process";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Prépare une base dédiée aux tests (`<base>_test`), repartie de zéro à chaque lancement,
 * puis applique toutes les migrations. La base de dev n'est jamais touchée.
 */
export default async function setup() {
  try {
    loadEnvFile(new URL("../../../.env", import.meta.url).pathname);
  } catch {
    // En CI, DATABASE_URL vient de l'environnement.
  }
  const devUrl = process.env.DATABASE_URL;
  if (!devUrl) throw new Error("DATABASE_URL manquant pour les tests d'intégration");

  const testUrl = new URL(devUrl);
  const testDatabase = `${testUrl.pathname.slice(1)}_test`;
  testUrl.pathname = `/${testDatabase}`;

  const admin = postgres(devUrl, { max: 1, onnotice: () => {} });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${testDatabase}" WITH (FORCE)`);
  await admin.unsafe(`CREATE DATABASE "${testDatabase}"`);
  await admin.end();

  const client = postgres(testUrl.toString(), { max: 1, onnotice: () => {} });
  await migrate(drizzle(client), {
    migrationsFolder: new URL("../migrations", import.meta.url).pathname,
  });
  await client.end();

  process.env.TEST_DATABASE_URL = testUrl.toString();
}
