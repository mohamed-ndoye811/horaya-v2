import { createServerFn } from "@tanstack/react-start";
import { saveImageImpl, uploadDocumentImpl } from "@/server/files";

/** Envoi (ou retrait) d'une image : `target`, `id` de la cible, `file` (absent pour retirer). */
const saveImageFn = createServerFn({ method: "POST" })
  .validator((data: FormData) => data)
  .handler(({ data }) => saveImageImpl(data));

export const saveImageAction = (data: FormData) => saveImageFn({ data });

/** Module « Documents joints » : envoi d'un PDF (`file`), joint au type à l'enregistrement. */
const uploadDocumentFn = createServerFn({ method: "POST" })
  .validator((data: FormData) => data)
  .handler(({ data }) => uploadDocumentImpl(data));

export const uploadDocumentAction = (data: FormData) => uploadDocumentFn({ data });
