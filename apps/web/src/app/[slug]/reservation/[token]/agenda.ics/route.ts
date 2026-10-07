import { hashToken } from "@horaya/core";
import { getManagedBooking, getPublicWorkspace } from "@horaya/db";
import { buildIcs } from "@/lib/ics";
import { db } from "@/server/db";
import { absoluteUrl } from "@/server/mailer";

/** Fichier .ics de la réservation (Apple Calendrier, Outlook). */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/[slug]/reservation/[token]/agenda.ics">,
) {
  const { slug, token } = await params;
  const workspace = await getPublicWorkspace(db, slug);
  const booking = workspace
    ? await getManagedBooking(db, workspace.id, await hashToken(token))
    : null;
  const startsAt = booking?.eventStartsAt ?? booking?.rentalStartsAt;
  const endsAt = booking?.eventEndsAt ?? booking?.rentalEndsAt;
  if (!workspace || !booking || !startsAt || !endsAt)
    return new Response("Réservation introuvable", { status: 404 });

  const ics = buildIcs({
    uid: `${booking.id}@horaya.app`,
    title: booking.eventTitle ?? "Location de matériel",
    startsAt,
    endsAt,
    location: [booking.locationName, booking.locationAddress].filter(Boolean).join(", ") || null,
    description: `Réservation ${booking.reference} · ${workspace.name}`,
    url: absoluteUrl(`/${slug}/reservation/${token}`),
    organizer: workspace.name,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${booking.reference}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
