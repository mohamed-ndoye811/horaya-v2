import { describe, expect, it } from "vitest";
import { buildIcs, googleCalendarUrl } from "./ics";

const event = {
  uid: "abc@horaya.app",
  title: "Séminaire annuel; jour 1",
  startsAt: new Date("2026-06-15T12:00:00Z"),
  endsAt: new Date("2026-06-16T14:30:00Z"),
  location: "445 rue de la Thèse, Puget-Ville",
  organizer: "Cabinet Vidal",
  now: new Date("2026-06-01T08:00:00Z"),
};

describe("buildIcs", () => {
  it("produit un VEVENT en UTC, échappé, en CRLF", () => {
    const ics = buildIcs(event);
    expect(ics).toContain("DTSTART:20260615T120000Z\r\n");
    expect(ics).toContain("DTEND:20260616T143000Z\r\n");
    expect(ics).toContain("SUMMARY:Séminaire annuel; jour 1");
    expect(ics).toContain("LOCATION:445 rue de la Thèse\\, Puget-Ville");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  });

  it("replie les lignes trop longues", () => {
    const ics = buildIcs({ ...event, description: "x".repeat(200) });
    for (const line of ics.split("\r\n"))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics).toContain("\r\n x");
  });
});

it("construit le lien Google Agenda", () => {
  const url = new URL(googleCalendarUrl(event));
  expect(url.searchParams.get("dates")).toBe("20260615T120000Z/20260616T143000Z");
  expect(url.searchParams.get("text")).toBe("Séminaire annuel; jour 1");
});
