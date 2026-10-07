import { redirect } from "next/navigation";
import { getSession, listMyWorkspaces } from "@/server/auth";

/** Écrans publics du compte : un utilisateur déjà connecté file vers son espace. */
export async function redirectIfSignedIn(target?: string) {
  const session = await getSession();
  if (!session) return;
  if (target) redirect(target);
  const workspaces = await listMyWorkspaces();
  redirect(workspaces.length > 0 ? "/app" : "/inscription/espace");
}
