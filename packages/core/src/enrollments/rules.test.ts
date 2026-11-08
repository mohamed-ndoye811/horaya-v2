import { describe, expect, it } from "vitest";
import { ConflictError } from "../shared/errors";
import {
  assertEnrollmentFits,
  enrollmentProgress,
  enrollmentQuote,
  isMakeupEarned,
  makeupTargetIssue,
  remainingSessions,
} from "./rules";

const tuesday = (day: number) => new Date(Date.UTC(2026, 10, day, 17, 30));
const session = (day: number, seatsHeld: number, capacity: number | null = 8) => ({
  startsAt: tuesday(day),
  capacity,
  seatsHeld,
  alreadyBooked: false,
});

describe("séances restantes", () => {
  it("ne garde que les séances publiées pas encore commencées, dans l'ordre", () => {
    const now = tuesday(10);
    const events = [
      { id: "c", status: "published" as "published" | "cancelled", startsAt: tuesday(24) },
      { id: "a", status: "published" as "published" | "cancelled", startsAt: tuesday(3) },
      { id: "x", status: "cancelled" as const, startsAt: tuesday(17) },
      { id: "b", status: "published" as "published" | "cancelled", startsAt: tuesday(17) },
      { id: "now", status: "published" as "published" | "cancelled", startsAt: now },
    ];
    expect(remainingSessions(events, now).map((event) => event.id)).toEqual(["b", "c"]);
  });
});

describe("places pour une inscription à la série", () => {
  it("passe quand chaque séance a une place (ou n'a pas de jauge)", () => {
    expect(() =>
      assertEnrollmentFits([session(3, 7), session(10, 0), session(17, 99, null)], "Europe/Paris"),
    ).not.toThrow();
  });

  it("refuse en nommant toutes les séances complètes", () => {
    const run = () =>
      assertEnrollmentFits([session(3, 8), session(10, 2), session(17, 8)], "Europe/Paris");
    expect(run).toThrow(ConflictError);
    expect(run).toThrow("Ces séances sont complètes : mar 3 nov, mar 17 nov");
  });

  it("refuse une double réservation du même client", () => {
    expect(() =>
      assertEnrollmentFits([{ ...session(10, 1), alreadyBooked: true }], "Europe/Paris"),
    ).toThrow("Déjà une réservation à la séance pour : mar 10 nov");
  });

  it("refuse une série sans séance à venir", () => {
    expect(() => assertEnrollmentFits([], "Europe/Paris")).toThrow("plus de séance à venir");
  });
});

describe("progression d'une inscription", () => {
  const sessions = [3, 10, 17, 24].map((day) => ({
    startsAt: tuesday(day),
    endsAt: new Date(tuesday(day).getTime() + 2 * 3_600_000),
    absent: day === 17,
  }));

  it("compte la séance courante, les absences et la fin", () => {
    const progress = enrollmentProgress(sessions, tuesday(12));
    expect(progress).toMatchObject({
      total: 4,
      current: 3,
      finished: false,
      absences: 1,
      endsAt: sessions[3]?.endsAt,
    });
    // La prochaine séance où l'élève est attendu saute l'absence.
    expect(progress.next?.startsAt).toEqual(tuesday(24));
    expect(progress.sessions.map((entry) => entry.state)).toEqual([
      "done",
      "done",
      "current",
      "upcoming",
    ]);
  });

  it("s'arrête à N sur N une fois la série finie", () => {
    expect(enrollmentProgress(sessions, tuesday(30))).toMatchObject({
      current: 4,
      finished: true,
      next: null,
    });
  });
});

describe("prix au prorata", () => {
  it("6 séances restantes sur 8 : 180 € au lieu de 240 €", () => {
    expect(enrollmentQuote({ fullCents: 24000, remaining: 6, total: 8, prorata: true })).toEqual({
      priceCents: 18000,
      fullCents: 24000,
      remaining: 6,
      total: 8,
      prorated: true,
    });
  });
  it("arrondit à l'euro", () => {
    // 24000 × 5 ÷ 7 = 17142,86 centimes → 171 €
    expect(
      enrollmentQuote({ fullCents: 24000, remaining: 5, total: 7, prorata: true }).priceCents,
    ).toBe(17100);
  });
  it("plein tarif avant la première séance, ou si le réglage est désactivé", () => {
    expect(
      enrollmentQuote({ fullCents: 24000, remaining: 8, total: 8, prorata: true }),
    ).toMatchObject({
      priceCents: 24000,
      prorated: false,
    });
    expect(
      enrollmentQuote({ fullCents: 24000, remaining: 3, total: 8, prorata: false }),
    ).toMatchObject({
      priceCents: 24000,
      prorated: false,
    });
  });
});

describe("rattrapages", () => {
  const now = new Date("2026-11-10T10:00:00Z");
  const startsAt = new Date("2026-11-17T17:30:00Z");
  it("une absence signalée dans le délai gratuit donne un rattrapage", () => {
    const base = { makeupAllowed: true, startsAt, freeCancellationHours: 24 };
    expect(isMakeupEarned({ ...base, now })).toBe(true);
    // Absence tardive : moins de 24 h avant la séance.
    expect(isMakeupEarned({ ...base, now: new Date("2026-11-16T18:00:00Z") })).toBe(false);
  });
  it("pas de rattrapage si la série ne l'autorise pas, ni sans délai gratuit", () => {
    expect(isMakeupEarned({ makeupAllowed: false, startsAt, now, freeCancellationHours: 24 })).toBe(
      false,
    );
    expect(isMakeupEarned({ makeupAllowed: true, startsAt, now, freeCancellationHours: 0 })).toBe(
      false,
    );
  });

  const absent = { id: "a", eventTypeId: "tournage" };
  const seriesEndsAt = new Date("2026-12-22T19:30:00Z");
  const target = {
    id: "b",
    eventTypeId: "tournage",
    status: "published" as "published" | "cancelled",
    startsAt: new Date("2026-11-19T17:30:00Z"),
  };
  it("accepte une autre séance du même type avant la fin du trimestre", () => {
    expect(makeupTargetIssue({ absent, target, seriesEndsAt, now })).toBeNull();
  });
  it("refuse la séance manquée, un autre type, une séance close, passée ou après la fin", () => {
    const issue = (patch: Partial<typeof target>) =>
      makeupTargetIssue({ absent, target: { ...target, ...patch }, seriesEndsAt, now });
    expect(issue({ id: "a" })).not.toBeNull();
    expect(issue({ eventTypeId: "modelage" })).not.toBeNull();
    expect(issue({ status: "cancelled" })).not.toBeNull();
    expect(issue({ startsAt: new Date("2026-11-09T17:30:00Z") })).not.toBeNull();
    expect(issue({ startsAt: new Date("2027-01-05T17:30:00Z") })).not.toBeNull();
  });
});
