import { getInvitationSummary } from "@horaya/db";
import { db } from "./db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Invitation en attente passée en paramètre (?invitation=…) de la connexion ou de l'inscription. */
export async function invitationContext(value: string | string[] | undefined) {
  const id = Array.isArray(value) ? value[0] : value;
  if (!id || !UUID.test(id)) return null;
  const summary = await getInvitationSummary(db, id);
  if (summary?.status !== "pending" || summary.expiresAt <= new Date()) return null;
  return { id, email: summary.email, organizationName: summary.organizationName };
}

export const isInvitationId = (value: string) => UUID.test(value);
