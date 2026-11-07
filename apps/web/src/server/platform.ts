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
  getPlatformWorkspace,
  listPlatformUsers,
  listPlatformWorkspaces,
  platformStats,
} from "@horaya/db";
import { notFound } from "@tanstack/react-router";
import { z } from "zod";
import { requireSession } from "./auth";
import { db } from "./db";
import { env } from "./env";
import type { FormState } from "./form-state";
import { deps } from "./services";

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
