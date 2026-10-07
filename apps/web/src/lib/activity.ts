import { formatMoney } from "./format";

/** Phrases de l'historique d'une réservation (journal d'activité). */
export interface ActivityEntry {
  action: string;
  actorType: "member" | "customer" | "system";
  actorName: string | null;
  data: Record<string, unknown> | null;
}

const by = (entry: ActivityEntry) =>
  entry.actorName ? ` par ${entry.actorName.split(" ")[0]}` : "";

export function describeBookingActivity(
  entry: ActivityEntry,
  source?: string,
): { title: string; tone: "ink" | "warning" | "success" | "danger" } {
  const reason = typeof entry.data?.reason === "string" ? entry.data.reason : null;
  switch (entry.action) {
    case "booking.created": {
      const waitlisted = entry.data?.status === "waitlisted";
      const base =
        entry.actorType === "customer" || source === "public_page"
          ? "Demande reçue depuis la page publique"
          : `Réservation créée${by(entry)}`;
      return { title: waitlisted ? `${base} · liste d'attente` : base, tone: "ink" };
    }
    case "booking.confirmed":
      return { title: `Réservation validée${by(entry)}`, tone: "success" };
    case "booking.refused":
      return {
        title: `Demande refusée${by(entry)}${reason ? ` · ${reason}` : ""}`,
        tone: "danger",
      };
    case "booking.cancelled":
      if (reason === "event_cancelled")
        return { title: "Annulée avec l'événement", tone: "danger" };
      if (reason === "customer_request") return { title: "Annulée par le client", tone: "danger" };
      if (reason === "payment_expired")
        return { title: "Annulée : paiement en ligne non finalisé", tone: "danger" };
      return {
        title: `Réservation annulée${by(entry)}${reason ? ` · ${reason}` : ""}`,
        tone: "danger",
      };
    case "booking.promoted":
      return {
        title:
          entry.data?.status === "pending"
            ? "Sortie de la liste d'attente · à valider"
            : "Sortie de la liste d'attente",
        tone: "warning",
      };
    case "booking.paid": {
      const amount = Number(entry.data?.amountCents ?? 0);
      return {
        title: `${entry.data?.kind === "deposit" ? "Acompte payé" : "Payé en ligne"} · ${formatMoney(amount)}`,
        tone: "success",
      };
    }
    case "booking.refunded":
      return {
        title: `Remboursé${by(entry)} · ${formatMoney(Number(entry.data?.amountCents ?? 0))}`,
        tone: "warning",
      };
    default:
      return { title: entry.action, tone: "ink" };
  }
}
