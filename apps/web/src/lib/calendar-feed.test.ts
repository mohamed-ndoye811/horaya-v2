import { describe, expect, it } from "vitest";
import { calendarFeedIcs, customerFeedIcs, type FeedEvent } from "./calendar-feed";

const base: FeedEvent = {
  id: "0192f0a0-0000-7000-8000-000000000001",
  title: "Atelier céramique",
  status: "published",
  startsAt: new Date("2026-11-10T09:00:00Z"),
  endsAt: new Date("2026-11-10T12:00:00Z"),
  locationName: "Atelier Vidal",
  locationAddress: "12 rue de la Paix, Toulon",
  onlineUrl: null,
  capacity: 10,
  seatsHeld: 3,
};

describe("calendarFeedIcs", () => {
  it("liste les événements avec un UID stable, un lien vers la fiche et les annulés marqués", () => {
    const ics = calendarFeedIcs({
      workspaceName: "Cabinet Vidal",
      events: [base, { ...base, id: "0192f0a0-0000-7000-8000-000000000002", status: "cancelled" }],
      eventUrl: (id) => `https://horaya.app/app/evenements/${id}`,
      now: new Date("2026-10-01T08:00:00Z"),
    });
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("UID:evenement-0192f0a0-0000-7000-8000-000000000001@horaya.app\r\n");
    expect(ics).toContain("X-WR-CALNAME:Cabinet Vidal · Horaya\r\n");
    expect(ics).toContain("LOCATION:Atelier Vidal\\, 12 rue de la Paix\\, Toulon\r\n");
    expect(ics).toContain("DESCRIPTION:3 inscrits sur 10 places\\nFiche dans Horaya");
    expect(ics).toContain(
      "URL:https://horaya.app/app/evenements/0192f0a0-0000-7000-8000-000000000001",
    );
    expect(ics.match(/STATUS:CANCELLED/g)).toHaveLength(1);
  });
});

describe("customerFeedIcs", () => {
  it("liste les réservations du client, annulées marquées, avec le lien de son espace", () => {
    const booking = {
      id: "0192f0a0-0000-7000-8000-00000000000a",
      title: "Stage émaillage",
      status: "confirmed",
      startsAt: new Date("2026-11-22T09:00:00Z"),
      endsAt: new Date("2026-11-22T16:00:00Z"),
      locationName: "Terre & Feu",
      reference: "TF-2611-0001",
      workspaceName: "Terre & Feu",
      url: "https://horaya.app/terre-et-feu/mon-espace/0192f0a0",
    };
    const ics = customerFeedIcs({
      name: "Mes cours · Terre & Feu",
      bookings: [
        booking,
        { ...booking, id: "0192f0a0-0000-7000-8000-00000000000b", status: "cancelled" },
      ],
      now: new Date("2026-11-08T10:00:00Z"),
    });
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("UID:0192f0a0-0000-7000-8000-00000000000a@horaya.app\r\n");
    expect(ics.match(/STATUS:CANCELLED/g)).toHaveLength(1);
    expect(ics).toContain("DESCRIPTION:Réservation TF-2611-0001 · Terre & Feu\r\n");
  });
});
