import { randomUUID } from "node:crypto";
import { AwsClient } from "aws4fetch";
import { FILE_KEY } from "@/lib/files";
import { env } from "./env";

/*
 * Fichiers des espaces (photos, couvertures, logos) sur un bucket Backblaze B2 privé, via son
 * API S3. Le navigateur ne voit jamais le bucket : l'app enregistre l'adresse `/fichiers/<clé>`
 * et la route du même nom va chercher le fichier (voir routes/fichiers/$.ts).
 */

/** Images acceptées et leur extension. */
const IMAGE_TYPES: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};
/** Le navigateur réduit les photos avant l'envoi : 5 Mo laisse de la marge. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const FILE_PREFIX = "/fichiers/";
export type FileFolder = "articles" | "evenements" | "profils" | "logos";

const client =
  env.STORAGE_ENDPOINT &&
  env.STORAGE_BUCKET &&
  env.STORAGE_ACCESS_KEY_ID &&
  env.STORAGE_SECRET_ACCESS_KEY
    ? new AwsClient({
        accessKeyId: env.STORAGE_ACCESS_KEY_ID,
        secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
        service: "s3",
        region: env.STORAGE_REGION ?? "us-east-1",
      })
    : null;

const objectUrl = (key: string) => `${env.STORAGE_ENDPOINT}/${env.STORAGE_BUCKET}/${key}`;

/** Contrôle une image envoyée : message d'erreur, ou `null` si elle convient. */
export function imageProblem(file: File): string | null {
  if (!client) return "L'envoi de fichiers n'est pas configuré sur ce serveur.";
  if (!IMAGE_TYPES[file.type]) return "Formats acceptés : JPEG, PNG ou WebP.";
  if (file.size > MAX_IMAGE_BYTES) return "Image trop lourde (5 Mo au plus).";
  return null;
}

/** Range l'image dans le bucket et renvoie son adresse dans l'app (`/fichiers/…`). */
export async function storeImage(file: File, owner: string, folder: FileFolder): Promise<string> {
  if (!client) throw new Error("Stockage non configuré");
  const key = `${owner}/${folder}/${randomUUID()}.${IMAGE_TYPES[file.type]}`;
  const response = await client.fetch(objectUrl(key), {
    method: "PUT",
    body: await file.arrayBuffer(),
    headers: { "Content-Type": file.type },
  });
  if (!response.ok) throw new Error(`Stockage : envoi refusé (${response.status})`);
  return FILE_PREFIX + key;
}

/** Lit un fichier du bucket (réponse S3 telle quelle) ; `null` si le stockage est absent. */
export async function readFile(key: string): Promise<Response | null> {
  return client ? client.fetch(objectUrl(key)) : null;
}

/** Supprime un fichier rangé par l'app ; une adresse étrangère est ignorée, un échec aussi. */
export async function deleteFile(url: string | null | undefined): Promise<void> {
  const key = url?.startsWith(FILE_PREFIX) ? url.slice(FILE_PREFIX.length) : null;
  if (!client || !key || !FILE_KEY.test(key)) return;
  // Un fichier orphelin ne casse rien : la suppression ne doit pas faire échouer l'action.
  await client.fetch(objectUrl(key), { method: "DELETE" }).catch(() => undefined);
}
