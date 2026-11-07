import {
  BILLING_RATES,
  type BillingRate,
  getCurrentPlan,
  getWorkspaceBilling,
  grantPlan,
  revokePlanGrant,
  setBillingRate,
} from "@horaya/core";
import {
  deleteWorkspace,
  getPlatformWorkspace,
  listPlatformUsers,
  listPlatformWorkspaces,
  ownedWorkspaces,
  platformStats,
} from "@horaya/db";
import { notFound, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { auth, platformAdminIds, requestHeaders, requireSession } from "./auth";
import { authApiFormState } from "./auth-errors";
import { db } from "./db";
import { env } from "./env";
import type { FormState } from "./form-state";
import { hasRunningSubscription } from "./privacy";
import { deps } from "./services";
import { deleteFolder } from "./storage";

/*
 * Cockpit de la plateforme : réservé à l'équipe Horaya (PLATFORM_ADMINS). Pour les autres,
 * l'écran n'existe pas (404), sans dire qu'il y a quelque chose ici.
 */

const ADMINS = new Set(
  (env.PLATFORM_ADMINS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

export const isPlatformAdmin = (email: string) => ADMINS.has(email.toLowerCase());

async function requirePlatformAdmin() {
  const { user } = await requireSession();
  if (!isPlatformAdmin(user.email)) throw notFound();
  if (!platformAdminIds.includes(user.id)) platformAdminIds.push(user.id);
  return user;
}

const DAY = 864e5;

/** Accueil du cockpit : chiffres sur 30 jours et liste des espaces avec leur formule. */
export async function platformHome(query: string | undefined) {
  await requirePlatformAdmin();
  const since = new Date(Date.now() - 30 * DAY);
  const [stats, workspaces] = await Promise.all([
    platformStats(db, since),
    listPlatformWorkspaces(db, query, since),
  ]);
  // shortcut: une lecture de formule par espace (200 au plus) ; à regrouper au-delà de quelques centaines.
  const plans = await Promise.all(workspaces.map((row) => getCurrentPlan(deps, row.id)));
  const rows = workspaces.map((row, index) => ({ ...row, current: plans[index] }));
  const paying = rows.filter((row) => row.current?.source === "subscription").length;
  return { stats: { ...stats, paying }, rows, query: query ?? "" };
}

export async function platformWorkspace(organizationId: string) {
  await requirePlatformAdmin();
  const [detail, billing] = await Promise.all([
    getPlatformWorkspace(db, organizationId),
    getWorkspaceBilling(deps, organizationId),
  ]);
  if (!detail) throw notFound();
  return {
    ...detail,
    billing,
    history: detail.history.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      label: historyLabel(entry.action, entry.data ?? {}),
      by: typeof entry.data?.by === "string" ? entry.data.by : null,
    })),
  };
}

const PLAN_NAMES: Record<string, string> = { libre: "Libre", pro: "Pro", equipe: "Équipe" };
const RATE_NAMES: Record<string, string> = {
  standard: "standard",
  solidaire: "solidaire",
  beta: "bêta-testeur",
};

/** Ligne lisible du journal de facturation d'un espace. */
function historyLabel(action: string, data: Record<string, unknown>): string {
  const plan = PLAN_NAMES[String(data.plan)] ?? String(data.plan ?? "");
  switch (action) {
    case "billing.plan_granted":
      return `Licence ${data.kind === "beta" ? "bêta-testeur" : "offerte"} : ${plan}`;
    case "billing.plan_revoked":
      return "Licence retirée";
    case "billing.rate_updated":
      return `Tarif ${RATE_NAMES[String(data.rate)] ?? String(data.rate)}`;
    case "billing.subscription_updated":
      return `Abonnement ${plan} (${data.interval === "year" ? "annuel" : "mensuel"}) : ${String(data.status)}`;
    default:
      return action;
  }
}

export async function platformUsers(query: string | undefined) {
  await requirePlatformAdmin();
  return { rows: await listPlatformUsers(db, query), query: query ?? "" };
}

const grantSchema = z.object({
  organizationId: z.uuid(),
  kind: z.enum(["beta", "gift"]),
  plan: z.enum(["pro", "equipe"]),
  days: z
    .string()
    .trim()
    .transform((value) => (value ? Number(value) : null))
    .pipe(z.number().int().min(1).max(3650).nullable()),
  reason: z
    .string()
    .trim()
    .max(200)
    .transform((value) => value || null),
});

/** Accorde une licence (bêta-testeur, offerte), avec ou sans fin. */
export async function grantLicence(form: FormData): Promise<FormState> {
  const admin = await requirePlatformAdmin();
  const parsed = grantSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Vérifie la durée (en jours) et le motif." };
  const { organizationId, ...input } = parsed.data;
  await grantPlan(deps, organizationId, input, admin.email);
  return { success: "Licence accordée." };
}

export async function revokeLicence(organizationId: string, grantId: string): Promise<FormState> {
  const admin = await requirePlatformAdmin();
  const done = await revokePlanGrant(deps, organizationId, grantId, admin.email);
  return done ? { success: "Licence retirée." } : { error: "Licence introuvable." };
}

export async function changeRate(organizationId: string, rate: BillingRate): Promise<FormState> {
  const admin = await requirePlatformAdmin();
  if (!(BILLING_RATES as readonly string[]).includes(rate)) return { error: "Tarif inconnu." };
  await setBillingRate(deps, organizationId, rate, admin.email);
  return { success: "Tarif enregistré : il s'applique au prochain paiement." };
}

/* Actions sur les comptes et les espaces (module admin de Better Auth, appelé côté serveur) */

/** Suspend (sessions coupées, connexion refusée) ou réactive un compte. */
export async function suspendUser(userId: string, suspended: boolean): Promise<FormState> {
  const admin = await requirePlatformAdmin();
  if (userId === admin.id) return { error: "Tu ne peux pas suspendre ton propre compte." };
  try {
    if (suspended) {
      await auth.api.banUser({
        body: { userId, banReason: `Suspendu par ${admin.email}` },
        headers: requestHeaders(),
      });
    } else {
      await auth.api.unbanUser({ body: { userId }, headers: requestHeaders() });
    }
  } catch (error) {
    return authApiFormState(error);
  }
  return { success: suspended ? "Compte suspendu." : "Compte réactivé." };
}

/** « Se connecter en tant que » : une heure au plus, bandeau de retour dans l'app. */
export async function impersonateUser(userId: string): Promise<FormState> {
  const admin = await requirePlatformAdmin();
  if (userId === admin.id) return { error: "C'est déjà ton compte." };
  try {
    await auth.api.impersonateUser({ body: { userId }, headers: requestHeaders() });
  } catch (error) {
    return authApiFormState(error);
  }
  throw redirect({ href: "/app" });
}

/** Supprime un compte (RGPD), une fois ses espaces supprimés ou donnés. */
export async function deleteUserAccount(userId: string): Promise<FormState> {
  const admin = await requirePlatformAdmin();
  if (userId === admin.id) return { error: "Supprime ton propre compte depuis ton profil." };
  const owned = await ownedWorkspaces(db, userId);
  if (owned.length > 0) {
    return {
      error: `Ce compte possède encore ${owned.map((entry) => entry.name).join(", ")} : supprime ou donne ces espaces d'abord.`,
    };
  }
  try {
    await auth.api.removeUser({ body: { userId }, headers: requestHeaders() });
  } catch (error) {
    return authApiFormState(error);
  }
  // Photo de profil comprise : tous les fichiers du compte sont rangés sous son identifiant.
  await deleteFolder(userId);
  return { success: "Compte supprimé." };
}

/** Supprime un espace et toutes ses données, après avoir retapé son adresse. */
export async function deletePlatformWorkspace(
  organizationId: string,
  confirm: string,
): Promise<FormState> {
  await requirePlatformAdmin();
  const detail = await getPlatformWorkspace(db, organizationId);
  if (!detail) return { error: "Espace introuvable." };
  if (confirm.trim() !== detail.workspace.slug) {
    return { error: `Tape « ${detail.workspace.slug} » pour confirmer.` };
  }
  if (await hasRunningSubscription(organizationId)) {
    return { error: "Abonnement Polar encore actif : à résilier avant de supprimer l'espace." };
  }
  await deleteFolder(organizationId);
  await deleteWorkspace(db, organizationId);
  throw redirect({ href: "/app/plateforme" });
}
