import { createServerFn } from "@tanstack/react-start";
import { saveImageImpl } from "@/server/files";

/** Envoi (ou retrait) d'une image : `target`, `id` de la cible, `file` (absent pour retirer). */
const saveImageFn = createServerFn({ method: "POST" })
  .validator((data: FormData) => data)
  .handler(({ data }) => saveImageImpl(data));

export const saveImageAction = (data: FormData) => saveImageFn({ data });
