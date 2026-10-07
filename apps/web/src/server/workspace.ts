import { tenantSettingsReader } from "@horaya/db";
import { cache } from "react";
import { requireWorkspace } from "./auth";
import { db } from "./db";
import { requireMember } from "./services";

/** Tout ce qu'un écran de l'admin doit savoir : qui, quel espace, quel fuseau. */
export const getWorkspaceContext = cache(async () => {
  const { user, workspace } = await requireWorkspace();
  const actor = await requireMember();
  const settings = await tenantSettingsReader(db).get(workspace.id);
  return { user, workspace, actor, settings, timeZone: settings.timezone };
});
