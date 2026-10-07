import { auth } from "@/server/auth";

/** E-mail du compte lié à un lien de réinitialisation encore valide, sinon null. */
export async function findPasswordResetEmail(token: string): Promise<string | null> {
  if (!token) return null;
  const { internalAdapter } = await auth.$context;
  const verification = await internalAdapter.findVerificationValue(`reset-password:${token}`);
  if (!verification || verification.expiresAt < new Date()) return null;
  const user = await internalAdapter.findUserById(verification.value);
  return user?.email ?? null;
}
