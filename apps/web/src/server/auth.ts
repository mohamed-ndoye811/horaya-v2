import { type Auth, createAuth } from "@horaya/auth";
import { createConsoleMailer, createSmtpMailer } from "@horaya/mail";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { env, googleEnabled } from "./env";

const globalForAuth = globalThis as unknown as { horayaAuth?: Auth };

export const auth =
  globalForAuth.horayaAuth ??
  createAuth(db, {
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    mailer: env.SMTP_URL
      ? createSmtpMailer({ url: env.SMTP_URL, from: env.MAIL_FROM })
      : createConsoleMailer(),
    google:
      googleEnabled && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
        : undefined,
  });
if (process.env.NODE_ENV !== "production") globalForAuth.horayaAuth = auth;

/** Session courante (dédoublonnée sur un même rendu). */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Session obligatoire : renvoie vers la connexion sinon. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/connexion");
  return session;
}

/** Espaces dont l'utilisateur connecté est membre. */
export const listMyWorkspaces = cache(async () =>
  auth.api.listOrganizations({ headers: await headers() }),
);

/** Utilisateur connecté et son espace actif ; renvoie vers l'onboarding s'il n'en a pas. */
export const requireWorkspace = cache(async () => {
  const { user, session } = await requireSession();
  const workspaces = await listMyWorkspaces();
  const workspace =
    workspaces.find((candidate) => candidate.id === session.activeOrganizationId) ?? workspaces[0];
  if (!workspace) redirect("/inscription/espace");
  return { user, session, workspace };
});
