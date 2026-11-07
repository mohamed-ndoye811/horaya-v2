import { describe, expect, it } from "vitest";
import { ConflictError } from "../shared/errors";
import { assertEnrollmentFits, enrollmentProgress, remainingSessions } from "./rules";

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
      { id: "c", status: "published" as const, startsAt: tuesday(24) },
      { id: "a", status: "published" as const, startsAt: tuesday(3) },
      { id: "x", status: "cancelled" as const, startsAt: tuesday(17) },
      { id: "b", status: "published" as const, startsAt: tuesday(17) },
      { id: "now", status: "published" as const, startsAt: now },
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
