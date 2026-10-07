"use server";

import { createWorkspaceSchema, slugSchema } from "@horaya/core";
import { tenantSettingsRepository, workspaceDirectory } from "@horaya/db";
import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, getSession } from "@/server/auth";
import { db } from "@/server/db";

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
export async function createWorkspace(
  _previous: WorkspaceFormState,
  formData: FormData,
): Promise<WorkspaceFormState> {
  const session = await getSession();
  if (!session) redirect("/connexion");

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
      headers: await headers(),
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
  redirect("/inscription/paiements");
}
