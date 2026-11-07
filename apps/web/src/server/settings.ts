/** Paramètres : logique serveur des formulaires et actions (voir functions/settings.ts). */
import {
  assertMemberCan,
  assertSeatAvailable,
  checkPassword,
  connectPaymentAccount,
  createWorkspaceSchema,
  type DisplayFont,
  generateToken,
  NOTIFICATION_TYPES,
  type NotificationType,
  refreshPaymentAccount,
  saveNotificationPreferences,
  slugSchema,
  updateTenantSettings,
} from "@horaya/core";
import { deleteJoinLink, saveJoinLink, workspaceDirectory } from "@horaya/db";
import { redirect } from "@tanstack/react-router";
import { z } from "zod";
import { ASSIGNABLE_ROLES, type AssignableRole, canManageTeam, JOIN_LINK_ROLES } from "@/lib/roles";
import { auth, requestHeaders, requireSession } from "./auth";
import { authApiFormState } from "./auth-errors";
import { db } from "./db";
import { type FormState, toFormState } from "./form-state";
import { absoluteUrl } from "./mailer";
import { paymentDeps } from "./payments";
import { deps } from "./services";
import { getWorkspaceContext } from "./workspace";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const integer = (value: string) => (value === "" ? Number.NaN : Number(value.replace(",", ".")));

export type SlugCheck =
  | { state: "available" | "current" }
  | { state: "taken" | "invalid"; message: string };

/** Vérification en direct de l'adresse publique (l'adresse actuelle de l'espace reste valable). */
export async function checkWorkspaceSlug(slug: string): Promise<SlugCheck> {
  const { workspace } = await getWorkspaceContext();
  if (slug === workspace.slug) return { state: "current" };
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success)
    return { state: "invalid", message: parsed.error.issues[0]?.message ?? "Adresse invalide" };
  return (await workspaceDirectory(db).isSlugTaken(parsed.data))
    ? { state: "taken", message: "Déjà prise" }
    : { state: "available" };
}

/** Écran 24 : identité (Better Auth) puis marque (réglages du core). */
export async function saveOrganization(form: FormData): Promise<FormState> {
  const { actor, workspace } = await getWorkspaceContext();
  const identity = createWorkspaceSchema.pick({ name: true, slug: true }).safeParse({
    name: text(form, "name"),
    slug: text(form, "slug"),
  });
  if (!identity.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of identity.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Vérifie les champs en rouge.", fieldErrors };
  }
  const { name, slug } = identity.data;
  try {
    assertMemberCan(actor, "settings", "update");
    // La marque d'abord : elle valide aussi le rôle avant de toucher à l'organisation.
    await updateTenantSettings(deps, actor, {
      brandColor: text(form, "brandColor"),
      displayFont: text(form, "displayFont") as DisplayFont,
      description: text(form, "description"),
      contactEmail: text(form, "contactEmail"),
      contactPhone: text(form, "contactPhone"),
      address: text(form, "address"),
      legalName: text(form, "legalName"),
      siret: text(form, "siret"),
    });
  } catch (error) {
    return toFormState(error);
  }
  if (slug !== workspace.slug && (await workspaceDirectory(db).isSlugTaken(slug))) {
    return {
      error: "Vérifie les champs en rouge.",
      fieldErrors: { slug: "Cette adresse est déjà prise" },
    };
  }
  if (name !== workspace.name || slug !== workspace.slug) {
    try {
      await auth.api.updateOrganization({
        body: { organizationId: workspace.id, data: { name, slug } },
        headers: requestHeaders(),
      });
    } catch (error) {
      return authApiFormState(error);
    }
  }
  return { success: "Paramètres enregistrés." };
}

/** Écran 26 : réglages des paiements de l'espace (si le rôle le permet). */
export async function savePayments(form: FormData): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    // Champs absents quand le bloc est en lecture seule (fieldset désactivé).
    if (form.has("vatRate")) {
      await updateTenantSettings(deps, actor, {
        vatRateBps: Math.round(integer(text(form, "vatRate")) * 100),
        defaultDepositPercent: integer(text(form, "defaultDepositPercent")),
        freeCancellationHours: integer(text(form, "freeCancellationHours")),
        lateCancellationRefundPercent: integer(text(form, "lateCancellationRefundPercent")),
        ...(form.has("paymentLinkUrl") ? { paymentLinkUrl: text(form, "paymentLinkUrl") } : {}),
      });
    }
  } catch (error) {
    return toFormState(error);
  }
  return { success: "Paramètres enregistrés." };
}

/** Préférences de notification du membre connecté (e-mail, dans l'app). */
export async function saveNotifications(form: FormData): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    await saveNotificationPreferences(
      deps,
      actor,
      NOTIFICATION_TYPES.map(({ value }) => ({
        type: value as NotificationType,
        email: form.get(`email:${value}`) === "on",
        inApp: form.get(`inApp:${value}`) === "on",
      })),
    );
  } catch (error) {
    return toFormState(error);
  }
  return { success: "Notifications enregistrées." };
}

/* Profil */

export async function saveProfile(form: FormData): Promise<FormState> {
  await requireSession();
  const firstName = text(form, "firstName");
  const lastName = text(form, "lastName");
  const fieldErrors: Record<string, string> = {};
  if (!firstName) fieldErrors.firstName = "Indique ton prénom";
  if (!lastName) fieldErrors.lastName = "Indique ton nom";
  if (firstName.length > 60) fieldErrors.firstName = "60 caractères maximum";
  if (lastName.length > 60) fieldErrors.lastName = "60 caractères maximum";
  if (Object.keys(fieldErrors).length > 0)
    return { error: "Vérifie les champs en rouge.", fieldErrors };
  try {
    await auth.api.updateUser({
      body: { firstName, lastName, name: `${firstName} ${lastName}` },
      headers: requestHeaders(),
    });
  } catch (error) {
    return authApiFormState(error);
  }
  return { success: "Profil enregistré." };
}

export async function changePassword(form: FormData): Promise<FormState> {
  await requireSession();
  const currentPassword = String(form.get("currentPassword") ?? "");
  const newPassword = String(form.get("newPassword") ?? "");
  const check = checkPassword(newPassword);
  if (!check.acceptable) {
    const missing = check.rules.filter((rule) => rule.required && !rule.met);
    return {
      error: "Vérifie les champs en rouge.",
      fieldErrors: {
        newPassword: `Il manque : ${missing.map((rule) => rule.label.toLowerCase()).join(", ")}.`,
      },
    };
  }
  try {
    await auth.api.changePassword({
      body: {
        currentPassword,
        newPassword,
        revokeOtherSessions: form.get("revokeOtherSessions") === "on",
      },
      headers: requestHeaders(),
    });
  } catch (error) {
    return authApiFormState(error);
  }
  return { success: "Mot de passe modifié." };
}

/* Membres */

const inviteSchema = z.object({
  email: z.email("Adresse e-mail invalide").trim().toLowerCase(),
  role: z.enum(ASSIGNABLE_ROLES, { error: "Choisis un rôle" }),
});

/** L'équipe passe par Better Auth (adhésions, invitations), qui vérifie aussi les droits. */
async function runTeam(
  work: (organizationId: string, headers: Headers) => Promise<unknown>,
  success: string,
): Promise<FormState> {
  const { workspace } = await getWorkspaceContext();
  try {
    await work(workspace.id, requestHeaders());
  } catch (error) {
    return authApiFormState(error);
  }
  return { success };
}

export async function inviteMember(form: FormData): Promise<FormState> {
  const parsed = inviteSchema.safeParse({ email: form.get("email"), role: form.get("role") });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Vérifie les champs en rouge.", fieldErrors };
  }
  const { email, role } = parsed.data;
  try {
    await assertSeatAvailable(deps, (await getWorkspaceContext()).workspace.id);
  } catch (error) {
    return toFormState(error);
  }
  return runTeam(
    (organizationId, headers) =>
      auth.api.createInvitation({ body: { email, role, organizationId }, headers }),
    `Invitation envoyée à ${email}.`,
  );
}

export function resendInvitation(email: string, role: AssignableRole) {
  return runTeam(
    (organizationId, headers) =>
      auth.api.createInvitation({ body: { email, role, organizationId, resend: true }, headers }),
    `Invitation renvoyée à ${email}.`,
  );
}

export function cancelInvitation(invitationId: string) {
  return runTeam(
    (_organizationId, headers) => auth.api.cancelInvitation({ body: { invitationId }, headers }),
    "Invitation annulée.",
  );
}

export function updateMemberRole(memberId: string, role: AssignableRole) {
  return runTeam(
    (organizationId, headers) =>
      auth.api.updateMemberRole({ body: { memberId, role, organizationId }, headers }),
    "Rôle mis à jour.",
  );
}

export function removeMember(memberId: string) {
  return runTeam(
    (organizationId, headers) =>
      auth.api.removeMember({ body: { memberIdOrEmail: memberId, organizationId }, headers }),
    "Membre retiré de l'espace.",
  );
}

/** Durée de validité du lien d'invitation général. */
const JOIN_LINK_DAYS = 7;

/** Le lien d'invitation se gère hors Better Auth : on vérifie le rôle ici. */
async function teamManager() {
  const { actor, workspace } = await getWorkspaceContext();
  return canManageTeam(actor.role) ? { actor, workspace } : null;
}

/** Crée le lien d'invitation, ou le régénère : l'ancien cesse aussitôt de marcher. */
export async function createJoinLink(role: AssignableRole): Promise<FormState> {
  const manager = await teamManager();
  if (!manager) return { error: "Seuls le propriétaire et les admins gèrent l'équipe." };
  if (!(JOIN_LINK_ROLES as readonly string[]).includes(role))
    return { error: "Rôle non autorisé." };
  try {
    await assertSeatAvailable(deps, manager.workspace.id);
  } catch (error) {
    return toFormState(error);
  }
  await saveJoinLink(db, {
    organizationId: manager.workspace.id,
    token: generateToken(),
    role,
    expiresAt: new Date(Date.now() + JOIN_LINK_DAYS * 86_400_000),
    createdByMemberId: manager.actor.memberId,
  });
  return { success: "Nouveau lien créé." };
}

export async function disableJoinLink(): Promise<FormState> {
  const manager = await teamManager();
  if (!manager) return { error: "Seuls le propriétaire et les admins gèrent l'équipe." };
  await deleteJoinLink(db, manager.workspace.id);
  return { success: "Lien désactivé." };
}

/* Stripe (route serveur /app/parametres/paiements/stripe) */

const PAYMENTS_PATH = "/app/parametres/paiements";

async function stripeOnboardingUrl() {
  const { actor, user, workspace } = await getWorkspaceContext();
  if (!paymentDeps) throw redirect({ href: PAYMENTS_PATH });
  const { url } = await connectPaymentAccount(paymentDeps, actor, {
    email: user.email,
    businessName: workspace.name,
    returnUrl: absoluteUrl(`${PAYMENTS_PATH}/stripe`),
    refreshUrl: absoluteUrl(`${PAYMENTS_PATH}/stripe?relancer=1`),
  });
  return url;
}

/** « Connecter Stripe » : vers l'activation du compte de l'organisateur chez Stripe. */
export async function connectStripe(): Promise<never> {
  let url: string;
  try {
    url = await stripeOnboardingUrl();
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("Connexion Stripe", error);
    throw redirect({ href: `${PAYMENTS_PATH}?stripe=erreur` });
  }
  throw redirect({ href: url });
}

/** Retour de l'activation Stripe : on relit l'état du compte (ou on relance un lien expiré). */
export async function stripeReturn(request: Request): Promise<never> {
  if (new URL(request.url).searchParams.get("relancer"))
    throw redirect({ href: await stripeOnboardingUrl() });
  const { workspace } = await getWorkspaceContext();
  if (paymentDeps) await refreshPaymentAccount(paymentDeps, workspace.id);
  throw redirect({ href: PAYMENTS_PATH });
}
