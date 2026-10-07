import { consumeRateLimit } from "@horaya/db";
import { headers } from "next/headers";
import { db } from "./db";

/** Adresse du visiteur (derrière le tunnel Cloudflare puis ingress-nginx). */
export async function clientIp(): Promise<string> {
  const list = await headers();
  return (
    list.get("cf-connecting-ip") ??
    list.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    list.get("x-real-ip") ??
    "inconnue"
  );
}

/** Message d'erreur si la limite est atteinte (ex. 10 demandes par heure), sinon null. */
export async function rateLimited(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<string | null> {
  const { allowed, retryAfterSeconds } = await consumeRateLimit(db, key, limit, windowSeconds);
  if (allowed) return null;
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Trop de demandes : réessaie dans ${minutes} minute${minutes > 1 ? "s" : ""}.`;
}
