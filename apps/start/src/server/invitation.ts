import { findUsableJoinLink, getInvitationSummary } from "@horaya/db";
import { db } from "./db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{20,100}$/;

/**
 * Espace à rejoindre après la connexion ou l'inscription : invitation par e-mail
 * (?invitation=…) ou lien d'invitation général (?rejoindre=…).
 */
export interface JoinTarget {
  /** Page où revenir une fois connecté. */
  returnTo: string;
  /** Paramètre à garder en passant de la connexion à l'inscription. */
  query: string;
  /** E-mail attendu (invitation nominative), prérempli. */
  email: string | null;
  organizationName: string;
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export async function joinTarget(params: {
  invitation?: string | string[];
  rejoindre?: string | string[];
}): Promise<JoinTarget | null> {
  const id = first(params.invitation);
  if (id && UUID.test(id)) {
    const summary = await getInvitationSummary(db, id);
    if (summary?.status !== "pending" || summary.expiresAt <= new Date()) return null;
    return {
      returnTo: `/invitation/${id}`,
      query: `invitation=${id}`,
      email: summary.email,
      organizationName: summary.organizationName,
    };
  }
  const token = first(params.rejoindre);
  if (token && isJoinToken(token)) {
    const link = await findUsableJoinLink(db, token, new Date());
    if (!link) return null;
    return {
      returnTo: `/rejoindre/${token}`,
      query: `rejoindre=${token}`,
      email: null,
      organizationName: link.organizationName,
    };
  }
  return null;
}

export const isInvitationId = (value: string) => UUID.test(value);
export const isJoinToken = (value: string) => TOKEN.test(value);
