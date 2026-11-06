import { type Auth, createAuth } from "@horaya/auth";
import { redirect } from "@tanstack/react-router";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { db } from "./db";
import { env, googleEnabled } from "./env";
import { mailer } from "./mailer";
import { authCookiePrefix } from "./poste";

const globalForAuth = globalThis as unknown as { horayaAuth?: Auth };

export const auth =
  globalForAuth.horayaAuth ??
  createAuth(db, {
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    mailer,
    google:
      googleEnabled && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
        : undefined,
    cookiePrefix: authCookiePrefix(env.POSTE),
    // Pose les cookies de session depuis les fonctions serveur TanStack Start.
    cookies: tanstackStartCookies(),
  });
if (process.env.NODE_ENV !== "production") globalForAuth.horayaAuth = auth;

/** En-têtes de la requête en cours (cookies de session compris). */
export const requestHeaders = () => new Headers(getRequestHeaders() as HeadersInit);

/** Session courante. À appeler depuis une fonction serveur ou une route serveur. */
export const getSession = () => auth.api.getSession({ headers: requestHeaders() });

/** Session obligatoire : renvoie vers la connexion sinon. */
export async function requireSession() {
  const session = await getSession();
  if (!session) throw redirect({ href: "/connexion" });
  return session;
}

/** Espaces dont l'utilisateur connecté est membre. */
export const listMyWorkspaces = () => auth.api.listOrganizations({ headers: requestHeaders() });

/** Utilisateur connecté et son espace actif ; renvoie vers l'onboarding s'il n'en a pas. */
export async function requireWorkspace() {
  const { user, session } = await requireSession();
  const workspaces = await listMyWorkspaces();
  const workspace =
    workspaces.find((candidate) => candidate.id === session.activeOrganizationId) ?? workspaces[0];
  if (!workspace) throw redirect({ href: "/inscription/espace" });
  return { user, session, workspace };
}
