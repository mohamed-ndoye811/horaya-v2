import { type BookingTab, listBookings } from "@horaya/db";
import { BOOKING_STATUS_BADGE } from "@/components/ui/status";
import { toCsv } from "@/lib/csv";
import { formatDateTimeShort, PAYMENT_MODE_LABELS } from "@/lib/format";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";

const TABS: BookingTab[] = ["all", "pending", "confirmed", "waitlisted", "cancelled"];

/** Export CSV de la liste des réservations, avec les filtres en cours. */
export async function GET(request: Request) {
  const { workspace, timeZone } = await getWorkspaceContext();
  const url = new URL(request.url);
  const tab = TABS.find((entry) => entry === url.searchParams.get("statut")) ?? "all";
  const rows = await listBookings(db, workspace.id, {
    tab,
    search: url.searchParams.get("q") ?? undefined,
    eventId: url.searchParams.get("evenement") ?? undefined,
    limit: 10_000,
  });
  const csv = toCsv(
    [
      "Référence",
      "Client",
      "E-mail",
      "Événement",
      "Date",
      "Places",
      "Montant (€)",
      "Paiement",
      "Statut",
      "Réservée le",
    ],
    rows.map((row) => [
      row.reference,
      row.customerName,
      row.customerEmail,
      row.eventTitle ?? "Location",
      row.eventStartsAt ? formatDateTimeShort(row.eventStartsAt, timeZone) : null,
      row.seats,
      (row.amountCents / 100).toFixed(2).replace(".", ","),
      PAYMENT_MODE_LABELS[row.paymentMode] ?? row.paymentMode,
      BOOKING_STATUS_BADGE[row.status].label,
      formatDateTimeShort(row.createdAt, timeZone),
    ]),
  );
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reservations-${workspace.slug}-${date}.csv"`,
    },
  });
}
