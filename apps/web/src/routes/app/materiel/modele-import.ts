import { createFileRoute } from "@tanstack/react-router";
import { itemImportTemplate } from "@/server/inventory";

/** Fichier modèle de l'import du matériel (session obligatoire). */
export const Route = createFileRoute("/app/materiel/modele-import")({
  server: { handlers: { GET: () => itemImportTemplate() } },
});
