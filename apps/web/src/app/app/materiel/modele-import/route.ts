import { ITEM_CSV_COLUMNS } from "@horaya/core";
import { toCsv } from "@/lib/csv";
import { getWorkspaceContext } from "@/server/workspace";

/** Fichier modèle de l'import du matériel : les intitulés et une ligne d'exemple. */
export async function GET() {
  await getWorkspaceContext();
  const csv = toCsv(
    ITEM_CSV_COLUMNS.map((column) => column.header),
    [ITEM_CSV_COLUMNS.map((column) => column.example)],
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="horaya-materiel-modele.csv"',
    },
  });
}
