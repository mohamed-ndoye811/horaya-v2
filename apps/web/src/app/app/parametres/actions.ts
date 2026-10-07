"use server";

import {
  assertMemberCan,
  createWorkspaceSchema,
  type DisplayFont,
  NOTIFICATION_TYPES,
  type NotificationType,
  saveNotificationPreferences,
  slugSchema,
  updateTenantSettings,
} from "@horaya/core";
import { workspaceDirectory } from "@horaya/db";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { authApiFormState } from "@/server/auth-errors";
import { db } from "@/server/db";
import { type FormState, toFormState } from "@/server/form-state";
import { deps } from "@/server/services";
import { getWorkspaceContext } from "@/server/workspace";

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
export async function saveOrganizationAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
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
        headers: await headers(),
      });
    } catch (error) {
      return authApiFormState(error);
    }
  }
  revalidatePath("/app", "layout");
  return { success: "Paramètres enregistrés." };
}

/** Écran 26 : réglages des paiements (si le rôle le permet) et notifications du membre. */
export async function savePaymentsAction(_previous: FormState, form: FormData): Promise<FormState> {
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
  revalidatePath("/app/parametres/paiements");
  return { success: "Paramètres enregistrés." };
}
