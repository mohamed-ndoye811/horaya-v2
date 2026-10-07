"use server";

import {
  type CalendarLinkFilter,
  createCalendarLink,
  deleteCalendarLink,
  updateCalendarLink,
} from "@horaya/core";
import { revalidatePath } from "next/cache";
import { type FormState, toFormState } from "@/server/form-state";
import { deps } from "@/server/services";
import { getWorkspaceContext } from "@/server/workspace";

const PATH = "/app/evenements/liens";

function linkFields(form: FormData) {
  return {
    name: String(form.get("name") ?? "").trim(),
    filterMode: String(form.get("filterMode") ?? "") as CalendarLinkFilter,
    filterIds: form.getAll("filterIds").map(String),
  };
}

async function run(work: () => Promise<unknown>, success: string): Promise<FormState> {
  try {
    await work();
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(PATH);
  return { success };
}

/** « Nouveau lien » ou modification (nom et événements montrés). */
export async function saveCalendarLinkAction(
  linkId: string | null,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  const { name, filterMode, filterIds } = linkFields(form);
  return linkId
    ? run(
        () => updateCalendarLink(deps, actor, linkId, { name, filter: { filterMode, filterIds } }),
        "Lien enregistré.",
      )
    : run(() => createCalendarLink(deps, actor, { name, filterMode, filterIds }), "Lien créé.");
}

export async function setCalendarLinkActiveAction(
  linkId: string,
  isActive: boolean,
): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  return run(
    () => updateCalendarLink(deps, actor, linkId, { isActive }),
    isActive ? "Lien réactivé." : "Lien désactivé : sa page ne s'ouvre plus.",
  );
}

export async function deleteCalendarLinkAction(linkId: string): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  return run(() => deleteCalendarLink(deps, actor, linkId), "Lien supprimé.");
}
