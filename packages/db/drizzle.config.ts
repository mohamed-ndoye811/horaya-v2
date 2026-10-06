import { loadEnvFile } from "node:process";
import { defineConfig } from "drizzle-kit";

try {
  loadEnvFile("../../.env");
} catch {
  // En CI, DATABASE_URL vient de l'environnement.
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
});
