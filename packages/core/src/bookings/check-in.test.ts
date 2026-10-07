import { describe, expect, it } from "vitest";
import { attendanceOf, attendanceRate, isCheckInOpen } from "./check-in";

const startsAt = new Date("2026-06-15T12:00:00Z");
const endsAt = new Date("2026-06-15T16:00:00Z");

describe("isCheckInOpen", () => {
  it("ouvre 24 h avant le début", () => {
    expect(isCheckInOpen({ startsAt }, new Date("2026-06-14T11:59:00Z"))).toBe(false);
    expect(isCheckInOpen({ startsAt }, new Date("2026-06-14T12:00:00Z"))).toBe(true);
  });

  it("reste ouvert après l'événement, pour corriger un oubli", () => {
    expect(isCheckInOpen({ startsAt }, new Date("2026-06-20T12:00:00Z"))).toBe(true);
  });
});

describe("attendanceOf", () => {
  const after = new Date("2026-06-15T17:00:00Z");
  const during = new Date("2026-06-15T13:00:00Z");

  it("compte présente toute réservation pointée", () => {
    expect(
      attendanceOf(
        { status: "confirmed", checkedInAt: during },
        { endsAt, checkInUsed: true },
        during,
      ),
    ).toBe("present");
  });

  it("compte absente une réservation confirmée non pointée, une fois l'événement fini", () => {
    const booking = { status: "confirmed" as const, checkedInAt: null };
    expect(attendanceOf(booking, { endsAt, checkInUsed: true }, after)).toBe("absent");
    expect(attendanceOf(booking, { endsAt, checkInUsed: true }, during)).toBeNull();
  });

  it("ne dit rien si l'équipe n'a pas fait le check-in de l'événement", () => {
    expect(
      attendanceOf(
        { status: "confirmed", checkedInAt: null },
        { endsAt, checkInUsed: false },
        after,
      ),
    ).toBeNull();
  });

  it("ignore les réservations annulées", () => {
    expect(
      attendanceOf(
        { status: "cancelled", checkedInAt: null },
        { endsAt, checkInUsed: true },
        after,
      ),
    ).toBeNull();
  });
});

describe("attendanceRate", () => {
  it("rapporte les présences aux présences connues", () => {
    expect(attendanceRate(["present", "present", "absent", null])).toBe(67);
  });

  it("renvoie null sans aucune présence connue", () => {
    expect(attendanceRate([null, null])).toBeNull();
  });
});
