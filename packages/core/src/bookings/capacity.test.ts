import { describe, expect, it } from "vitest";
import { ConflictError, ValidationError } from "../shared/errors";
import { decideBookingStatus, remainingSeats } from "./capacity";

const base = {
  capacity: 50,
  seatsHeld: 38,
  seatsRequested: 2,
  requiresApproval: false,
  waitlistEnabled: false,
};

describe("remainingSeats", () => {
  it("renvoie null quand la capacité est illimitée", () => {
    expect(remainingSeats(null, 1000)).toBeNull();
  });

  it("ne descend jamais sous zéro", () => {
    expect(remainingSeats(10, 12)).toBe(0);
  });
});

describe("decideBookingStatus", () => {
  it("confirme directement quand il reste de la place", () => {
    expect(decideBookingStatus(base)).toBe("confirmed");
  });

  it("met en attente de validation si l'événement l'exige", () => {
    expect(decideBookingStatus({ ...base, requiresApproval: true })).toBe("pending");
  });

  it("accepte de remplir exactement la dernière place", () => {
    expect(decideBookingStatus({ ...base, seatsHeld: 48, seatsRequested: 2 })).toBe("confirmed");
  });

  it("refuse la surréservation quand il n'y a pas de liste d'attente", () => {
    expect(() => decideBookingStatus({ ...base, seatsHeld: 49, seatsRequested: 2 })).toThrow(
      ConflictError,
    );
  });

  it("indique le nombre de places restantes dans l'erreur", () => {
    expect(() => decideBookingStatus({ ...base, seatsHeld: 49, seatsRequested: 2 })).toThrow(
      "Il ne reste que 1 place",
    );
  });

  it("signale un événement complet", () => {
    expect(() => decideBookingStatus({ ...base, seatsHeld: 50 })).toThrow(
      "Cet événement est complet",
    );
  });

  it("bascule en liste d'attente quand elle est activée", () => {
    expect(decideBookingStatus({ ...base, seatsHeld: 50, waitlistEnabled: true })).toBe(
      "waitlisted",
    );
  });

  it("ne limite pas une capacité illimitée", () => {
    expect(decideBookingStatus({ ...base, capacity: null, seatsHeld: 5000 })).toBe("confirmed");
  });

  it.each([0, -1, 1.5])("rejette un nombre de places invalide (%s)", (seatsRequested) => {
    expect(() => decideBookingStatus({ ...base, seatsRequested })).toThrow(ValidationError);
  });
});
