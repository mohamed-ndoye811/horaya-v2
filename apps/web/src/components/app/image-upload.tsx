import { useRef, useState, useTransition } from "react";
import { saveImageAction } from "@/functions/files";
import { useRouter } from "@/lib/navigation";

/** Ce qu'illustre l'image (voir server/files.ts). */
type ImageTarget = "article" | "evenement" | "profil" | "logo";

/**
 * Réduit une photo avant l'envoi (`max` px sur le grand côté, WebP) : une photo de téléphone
 * passe de quelques Mo à quelques centaines de Ko. Si le navigateur ne sait pas la lire, le
 * fichier part tel quel et le serveur tranche.
 */
async function shrink(file: File, max: number): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.85),
    );
    return blob ? new File([blob], "image.webp", { type: "image/webp" }) : file;
  } catch {
    return file;
  }
}

/**
 * Envoi d'une image : `pick` ouvre le sélecteur de fichiers (`fileInput` à poser dans le rendu),
 * `remove` retire l'image. Chaque écran garde son propre visuel ; la page se recharge ensuite.
 */
export function useImageUpload(target: ImageTarget, id?: string, max = 1600) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  const send = (file: File | null) =>
    startTransition(async () => {
      const data = new FormData();
      data.set("target", target);
      if (id) data.set("id", id);
      if (file) data.set("file", await shrink(file, max));
      const result = await saveImageAction(data);
      setError(result.error);
      if (!result.error) router.refresh();
    });

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      aria-label="Choisir une image"
      tabIndex={-1}
      className="sr-only"
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) send(file);
      }}
    />
  );

  return {
    pick: () => input.current?.click(),
    remove: () => send(null),
    pending,
    error,
    fileInput,
  };
}
