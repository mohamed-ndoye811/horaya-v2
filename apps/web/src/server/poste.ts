/**
 * Postes de travail locaux : un worktree git par poste, avec son port, sa base et ses cookies.
 * Voir « Postes de travail » dans CLAUDE.md.
 */
export const POSTES = ["integration", "lot", "fix"] as const;
export type Poste = (typeof POSTES)[number];

/**
 * Préfixe des cookies de session. Les cookies ne tiennent pas compte du port : sans préfixe,
 * se connecter sur localhost:3101 déconnecterait localhost:3100. Le poste integration,
 * staging et la prod gardent le préfixe par défaut de Better Auth.
 */
export function authCookiePrefix(poste: string | undefined): string | undefined {
  return poste === "lot" || poste === "fix" ? `horaya-${poste}` : undefined;
}
