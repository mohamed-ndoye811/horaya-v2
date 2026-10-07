// Point d'entrée pour la CLI Better Auth (`auth generate`), qui attend un export `auth`.
// Sert uniquement à régénérer packages/db/src/schema/auth.ts.
import { createDb } from "@horaya/db";
import { createConsoleMailer } from "@horaya/mail";
import { createAuth } from "./auth";

export const auth = createAuth(createDb(process.env.DATABASE_URL ?? ""), {
  baseURL: "http://localhost:3000",
  secret: "cli-only-secret-not-used-at-runtime",
  mailer: createConsoleMailer(),
});
