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
export type FileFolder = "articles" | "evenements" | "profils" | "logos" | "couvertures";
/** Documents joints d'un type (module Documents) : PDF seulement. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

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

/** Contrôle un document envoyé (PDF) : message d'erreur, ou `null` s'il convient. */
export function documentProblem(file: File): string | null {
  if (!client) return "L'envoi de fichiers n'est pas configuré sur ce serveur.";
  if (file.type !== "application/pdf") return "Format accepté : PDF.";
  if (file.size > MAX_DOCUMENT_BYTES) return "Document trop lourd (10 Mo au plus).";
  return null;
}

/** Range un PDF dans le bucket (`<espace>/documents/…`) et renvoie son adresse dans l'app. */
export async function storeDocument(file: File, owner: string): Promise<string> {
  if (!client) throw new Error("Stockage non configuré");
  const key = `${owner}/documents/${randomUUID()}.pdf`;
  const response = await client.fetch(objectUrl(key), {
    method: "PUT",
    body: await file.arrayBuffer(),
    headers: { "Content-Type": "application/pdf" },
  });
  if (!response.ok) throw new Error(`Stockage : envoi refusé (${response.status})`);
  return FILE_PREFIX + key;
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

/**
 * Supprime tous les fichiers d'un espace ou d'un compte (`<id>/…`) : RGPD, à la suppression.
 * Un échec est journalisé sans bloquer : un fichier orphelin ne casse rien.
 */
export async function deleteFolder(ownerId: string): Promise<void> {
  if (!client || !/^[0-9a-f-]{36}$/.test(ownerId)) return;
  let token: string | null = null;
  try {
    do {
      const url = new URL(`${env.STORAGE_ENDPOINT}/${env.STORAGE_BUCKET}`);
      url.searchParams.set("list-type", "2");
      url.searchParams.set("prefix", `${ownerId}/`);
      if (token) url.searchParams.set("continuation-token", token);
      const response = await client.fetch(url.toString());
      if (!response.ok) throw new Error(`Liste refusée (${response.status})`);
      const xml = await response.text();
      const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((match) => match[1] ?? "");
      await Promise.all(
        keys
          .filter((key) => FILE_KEY.test(key))
          .map((key) => client.fetch(objectUrl(key), { method: "DELETE" })),
      );
      token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
        ? (xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1] ?? null)
        : null;
    } while (token);
  } catch (error) {
    console.error("Stockage : suppression du dossier", ownerId, error);
  }
}
