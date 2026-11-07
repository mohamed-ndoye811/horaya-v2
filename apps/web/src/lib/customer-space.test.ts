import { describe, expect, it } from "vitest";
import { bookingBadge, cardDate, historySummary, isUpcoming } from "./customer-space";

const now = new Date("2026-11-08T10:00:00Z");

describe("espace client", () => {
  it("range les réservations actives et pas encore finies dans « À venir »", () => {
    const endsAt = new Date("2026-11-22T16:00:00Z");
    expect(isUpcoming({ status: "confirmed", endsAt }, now)).toBe(true);
    expect(isUpcoming({ status: "waitlisted", endsAt }, now)).toBe(true);
    expect(isUpcoming({ status: "cancelled", endsAt }, now)).toBe(false);
    expect(isUpcoming({ status: "confirmed", endsAt: new Date("2026-11-01T10:00:00Z") }, now)).toBe(
      false,
    );
  });

  it("met « À payer » avant « Confirmée », et « Payée » une fois réglé", () => {
    const base = { status: "confirmed" as const, paymentStatus: "none", amountCents: 8500 };
    expect(bookingBadge({ ...base, payable: true }).label).toBe("À payer");
    expect(bookingBadge({ ...base, paymentStatus: "paid", payable: false }).label).toBe("Payée");
    expect(bookingBadge({ ...base, payable: false }).label).toBe("Confirmée");
    expect(bookingBadge({ ...base, status: "pending", payable: false }).label).toBe("À valider");
    expect(bookingBadge({ ...base, payable: false, enrollmentId: "e" }).label).toBe(
      "Inscrit·e au trimestre",
    );
  });

  it("écrit les dates des cartes comme la maquette", () => {
    const tz = "Europe/Paris";
    expect(cardDate(new Date("2026-12-06T09:00:00Z"), new Date("2026-12-06T11:00:00Z"), tz)).toBe(
      "Dim. 6 déc.",
    );
    expect(cardDate(new Date("2026-11-22T09:00:00Z"), new Date("2026-11-23T16:00:00Z"), tz)).toBe(
      "Dim. 22 – lun. 23 nov.",
    );
    expect(cardDate(new Date("2026-11-30T09:00:00Z"), new Date("2026-12-01T16:00:00Z"), tz)).toBe(
      "Lun. 30 nov. – mar. 1 déc.",
    );
  });

  it("résume l'historique", () => {
    expect(
      historySummary(
        [
          { status: "confirmed", startsAt: new Date("2026-03-10T09:00:00Z") },
          { status: "cancelled", startsAt: new Date("2026-05-10T09:00:00Z") },
        ],
        "Europe/Paris",
      ),
    ).toBe("2 réservations depuis mars 2026 · 1 annulée");
  });
});
