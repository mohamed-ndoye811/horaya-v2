/** Compte et onboarding : logique serveur des écrans (voir functions/auth.ts). */
import {
  assertAcceptablePassword,
  createWorkspaceSchema,
  DomainError,
  slugSchema,
  updateTenantSettings,
} from "@horaya/core";
import { tenantSettingsRepository, workspaceDirectory } from "@horaya/db";
import { redirect } from "@tanstack/react-router";
import { isAPIError } from "better-auth/api";
import { auth, getSession, listMyWorkspaces, requestHeaders, requireSession } from "./auth";
import { db } from "./db";
import { googleEnabled } from "./env";
import { type FormState, toFormState } from "./form-state";
import { joinTarget } from "./invitation";
import { deps } from "./services";
import { getWorkspaceContext } from "./workspace";

/** Écrans publics du compte : un utilisateur déjà connecté file vers son espace. */
async function redirectIfSignedIn(target?: string) {
  const session = await getSession();
  if (!session) return;
  if (target) throw redirect({ href: target });
  const workspaces = await listMyWorkspaces();
  throw redirect({ href: workspaces.length > 0 ? "/app" : "/inscription/espace" });
}

/** Connexion et inscription : invitation éventuelle, Google activé ou non. */
export async function authPage(search: { invitation?: string; rejoindre?: string }) {
  const invitation = await joinTarget(search);
  await redirectIfSignedIn(invitation?.returnTo);
  return { googleEnabled, invitation };
}

/** Étapes 2 et 3 de l'inscription : session obligatoire, espace absent (2) ou déjà créé (3). */
export async function onboardingStep(step: "espace" | "paiements") {
  await requireSession();
  const hasWorkspace = (await listMyWorkspaces()).length > 0;
  if (step === "espace" && hasWorkspace) throw redirect({ href: "/app" });
  if (step === "paiements" && !hasWorkspace) throw redirect({ href: "/inscription/espace" });
  return null;
}

/** E-mail du compte lié à un lien de réinitialisation encore valide, sinon null. */
export async function findPasswordResetEmail(token: string): Promise<string | null> {
  if (!token) return null;
  const { internalAdapter } = await auth.$context;
  const verification = await internalAdapter.findVerificationValue(`reset-password:${token}`);
  if (!verification || verification.expiresAt < new Date()) return null;
  const user = await internalAdapter.findUserById(verification.value);
  return user?.email ?? null;
}

function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 3)}•••@${domain}`;
}

/** Écran 14 : Better Auth redirige ici avec ?token=… (ou ?error=INVALID_TOKEN). */
export async function resetPasswordPage(token: string) {
  const email = await findPasswordResetEmail(token);
  return { token, maskedEmail: email ? maskEmail(email) : null };
}

export interface ResetPasswordState {
  error?: string;
  expired?: boolean;
}

/** Enregistre le nouveau mot de passe puis connecte directement l'utilisateur. */
export async function resetPassword(
  token: string,
  formData: FormData,
): Promise<ResetPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  try {
    assertAcceptablePassword(password);
  } catch (error) {
    if (error instanceof DomainError)
      return { error: "Le mot de passe ne respecte pas les règles." };
    throw error;
  }
  if (password !== confirmation) return { error: "Les deux mots de passe ne correspondent pas." };

  // L'e-mail vient du jeton côté serveur, jamais du formulaire.
  const email = await findPasswordResetEmail(token);
  if (!email) return { expired: true };

  try {
    await auth.api.resetPassword({ body: { newPassword: password, token } });
    await auth.api.signInEmail({ body: { email, password }, headers: requestHeaders() });
  } catch (error) {
    if (isAPIError(error) && error.body?.code === "INVALID_TOKEN") return { expired: true };
    console.error("resetPassword", error);
    return { error: "Impossible d'enregistrer le mot de passe. Réessaie dans un instant." };
  }
  throw redirect({ href: "/app" });
}

export type SlugStatus =
  | { state: "available" }
  | { state: "taken"; message: string }
  | { state: "invalid"; message: string };

const slugTaken = (slug: string) => workspaceDirectory(db).isSlugTaken(slug);

/** Vérification en direct de l'adresse de la page publique. */
export async function checkSlug(slug: string): Promise<SlugStatus> {
  if (!(await getSession())) return { state: "invalid", message: "Session expirée" };

  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) {
    return { state: "invalid", message: parsed.error.issues[0]?.message ?? "Adresse invalide" };
  }
  return (await slugTaken(parsed.data))
    ? { state: "taken", message: "Déjà prise" }
    : { state: "available" };
}

export interface WorkspaceFormState {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "slug" | "sector" | "brandColor", string>>;
}

/** Crée l'organisation (Better Auth, rôle « owner ») puis enregistre son identité visuelle. */
export async function createWorkspace(formData: FormData): Promise<WorkspaceFormState> {
  const session = await getSession();
  if (!session) throw redirect({ href: "/connexion" });

  const parsed = createWorkspaceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: WorkspaceFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof NonNullable<WorkspaceFormState["fieldErrors"]>;
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }

  const { name, slug, sector, brandColor } = parsed.data;
  if (await slugTaken(slug)) return { fieldErrors: { slug: "Cette adresse est déjà prise" } };

  let organizationId: string;
  try {
    const created = await auth.api.createOrganization({
      body: { name, slug },
      headers: requestHeaders(),
    });
    if (!created) throw new Error("Organisation non créée");
    organizationId = created.id;
  } catch (error) {
    if (isAPIError(error) && error.body?.code === "ORGANIZATION_ALREADY_EXISTS") {
      return { fieldErrors: { slug: "Cette adresse est déjà prise" } };
    }
    console.error("createWorkspace", error);
    return { error: "Impossible de créer l'espace pour le moment. Réessaie dans un instant." };
  }

  await tenantSettingsRepository(db).saveBranding(organizationId, { brandColor, sector });
  throw redirect({ href: "/inscription/paiements" });
}

/** Étape 3 de l'inscription : enregistre le lien de paiement (facultatif), puis ouvre l'espace. */
export async function savePaymentLink(form: FormData): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  const paymentLinkUrl = String(form.get("paymentLinkUrl") ?? "").trim();
  if (paymentLinkUrl) {
    try {
      await updateTenantSettings(deps, actor, { paymentLinkUrl });
    } catch (error) {
      return toFormState(error);
    }
  }
  throw redirect({ href: "/app" });
}
