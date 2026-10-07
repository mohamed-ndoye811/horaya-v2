import { redirect } from "next/navigation";
import { getSession, listMyWorkspaces } from "@/server/auth";

/** Écrans publics du compte : un utilisateur déjà connecté file vers son espace. */
export async function redirectIfSignedIn() {
  const session = await getSession();
  if (!session) return;
  const workspaces = await listMyWorkspaces();
  redirect(workspaces.length > 0 ? "/app" : "/inscription/espace");
}
