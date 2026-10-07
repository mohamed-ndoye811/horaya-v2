/**
 * Jetons secrets (lien « Gérer ma réservation »…). On ne stocke que leur empreinte SHA-256.
 * Web Crypto : disponible dans Node comme dans le navigateur, sans dépendance.
 */
export function generateToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buffer);
  return toBase64Url(buffer);
}

export async function hashToken(token: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toBase64Url(new Uint8Array(digest));
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
