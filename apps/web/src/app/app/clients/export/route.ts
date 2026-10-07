import { type CustomerSegment, listCustomers } from "@horaya/db";
import { toCsv } from "@/lib/csv";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";

const SEGMENTS: CustomerSegment[] = ["all", "vip", "company", "inactive"];

/** Export CSV des clients, avec les filtres en cours. */
export async function GET(request: Request) {
  const { workspace } = await getWorkspaceContext();
  const url = new URL(request.url);
  const segment = SEGMENTS.find((entry) => entry === url.searchParams.get("segment")) ?? "all";
  const rows = await listCustomers(db, workspace.id, {
    segment,
    now: new Date(),
    search: url.searchParams.get("q") ?? undefined,
    limit: 50_000,
  });
  const csv = toCsv(
    [
      "Prénom",
      "Nom",
      "E-mail",
      "Téléphone",
      "Entreprise",
      "Réservations",
      "Dépensé (€)",
      "Étiquettes",
      "Client depuis",
    ],
    rows.map((row) => [
      row.firstName,
      row.lastName,
      row.email,
      row.phone,
      row.company,
      row.bookings,
      (row.spentCents / 100).toFixed(2).replace(".", ","),
      row.tags.join(", "),
      row.createdAt.toISOString().slice(0, 10),
    ]),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clients-${workspace.slug}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
