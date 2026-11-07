import { getWorkspaceBilling } from "@horaya/core";
import { deleteWorkspace } from "@horaya/db";
import { redirect } from "@tanstack/react-router";
import { auth, requestHeaders, requireSession } from "./auth";
import { authApiFormState } from "./auth-errors";
import { db } from "./db";
import type { FormState } from "./form-state";
import { deps } from "./services";
import { deleteFolder } from "./storage";
import { getWorkspaceContext } from "./workspace";

/*
 * RGPD, côté membre : supprimer son compte, ou l'espace dont on est propriétaire. Tout part
 * pour de bon (base et fichiers) ; l'export reste possible avant (clients, réservations).
 */

/** Un abonnement payant en cours bloque la suppression : il faut le résilier d'abord. */
export async function hasRunningSubscription(organizationId: string): Promise<boolean> {
  const { account } = await getWorkspaceBilling(deps, organizationId);
  const subscription = account.subscription;
  return Boolean(
    subscription && subscription.status !== "canceled" && !subscription.cancelAtPeriodEnd,
  );
}

/** Supprime l'espace actif (propriétaire), après avoir retapé son adresse. */
export async function deleteMyWorkspace(form: FormData): Promise<FormState> {
  const { workspace, actor } = await getWorkspaceContext();
  if (actor.role !== "owner") return { error: "Seul le propriétaire peut supprimer l'espace." };
  if (String(form.get("confirm") ?? "").trim() !== workspace.slug) {
    return { fieldErrors: { confirm: `Tape « ${workspace.slug} » pour confirmer.` } };
  }
  if (await hasRunningSubscription(workspace.id)) {
    return {
      error:
        "Ton abonnement est encore actif : résilie-le dans Réglages > Abonnement, puis supprime l'espace.",
    };
  }
  await deleteFolder(workspace.id);
  await deleteWorkspace(db, workspace.id);
  throw redirect({ href: "/app" });
}

/** Supprime son propre compte (mot de passe, ou session récente pour un compte Google). */
export async function deleteMyAccount(form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const password = String(form.get("password") ?? "");
  try {
    await auth.api.deleteUser({
      body: password ? { password } : {},
      headers: requestHeaders(),
    });
  } catch (error) {
    return authApiFormState(error);
  }
  // Photo de profil comprise : tous les fichiers du compte sont rangés sous son identifiant.
  await deleteFolder(user.id);
  throw redirect({ href: "/" });
}

/** Fin de « se connecter en tant que » : retour au compte de l'équipe Horaya. */
export async function stopImpersonation(): Promise<void> {
  await auth.api.stopImpersonating({ headers: requestHeaders() });
  throw redirect({ href: "/app/plateforme" });
}
