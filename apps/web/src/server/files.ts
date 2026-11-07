import { setEventCover, setItemPhoto, updateTenantSettings } from "@horaya/core";
import { getWorkspaceSettings } from "@horaya/db";
import { z } from "zod";
import { auth, requestHeaders } from "./auth";
import { authApiFormState } from "./auth-errors";
import { db } from "./db";
import type { FormState } from "./form-state";
import { toFormState } from "./form-state";
import { deps } from "./services";
import { deleteFile, type FileFolder, imageProblem, storeImage } from "./storage";
import { getWorkspaceContext } from "./workspace";

/** Ce qu'une image illustre : photo d'article, couverture d'événement, photo de profil, logo. */
export const IMAGE_TARGETS = ["article", "evenement", "profil", "logo", "couverture"] as const;
export type ImageTarget = (typeof IMAGE_TARGETS)[number];

const FOLDERS: Record<ImageTarget, FileFolder> = {
  article: "articles",
  evenement: "evenements",
  profil: "profils",
  logo: "logos",
  couverture: "couvertures",
};

/**
 * Pose (fichier présent) ou retire (fichier absent) l'image d'une cible. Les droits sont ceux de
 * la modification de la cible (core pour l'article et l'événement, Better Auth pour le profil et
 * le logo). L'ancienne image est supprimée du stockage une fois la nouvelle enregistrée.
 */
export async function saveImageImpl(form: FormData): Promise<FormState> {
  const target = form.get("target") as ImageTarget;
  if (!IMAGE_TARGETS.includes(target)) return { error: "Image inattendue." };
  const id = String(form.get("id") ?? "");
  if ((target === "article" || target === "evenement") && !z.uuid().safeParse(id).success)
    return { error: "Image inattendue." };
  const file = form.get("file");
  const image = file instanceof File && file.size > 0 ? file : null;
  if (image) {
    const problem = imageProblem(image);
    if (problem) return { error: problem };
  }

  const { user, workspace, actor } = await getWorkspaceContext();
  const owner = target === "profil" ? user.id : workspace.id;
  const url = image ? await storeImage(image, owner, FOLDERS[target]) : null;
  let previous: string | null | undefined;
  try {
    if (target === "article") previous = await setItemPhoto(deps, actor, id, url);
    else if (target === "evenement") previous = await setEventCover(deps, actor, id, url);
    else if (target === "profil") {
      previous = user.image;
      await auth.api.updateUser({ body: { image: url }, headers: requestHeaders() });
    } else if (target === "couverture") {
      previous = (await getWorkspaceSettings(db, workspace.id))?.coverImageUrl;
      await updateTenantSettings(deps, actor, { coverImageUrl: url });
    } else {
      previous = workspace.logo;
      await auth.api.updateOrganization({
        body: { organizationId: workspace.id, data: { logo: url } },
        headers: requestHeaders(),
      });
    }
  } catch (error) {
    // Refusé (droits, cible introuvable) : la nouvelle image ne doit pas rester orpheline.
    await deleteFile(url);
    return target === "profil" || target === "logo" ? authApiFormState(error) : toFormState(error);
  }
  await deleteFile(previous);
  return { success: url ? "Image enregistrée." : "Image retirée." };
}
