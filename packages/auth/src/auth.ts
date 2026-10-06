import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import type { Db } from "@horaya/db";
import { schema } from "@horaya/db";
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";

/**
 * Configuration Better Auth partagée par l'app web et l'API publique.
 * Le lot 2 ajoutera Google, l'envoi d'e-mails et les rôles détaillés
 * (owner / admin / editor / viewer).
 */
export function createAuth(db: Db) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: { enabled: true },
    plugins: [organization()],
    advanced: {
      database: { generateId: "uuid" },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
