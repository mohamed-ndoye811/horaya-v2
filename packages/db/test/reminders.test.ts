import { createEvent, createEventBooking, createEventType, publishEvent } from "@horaya/core";
import { afterAll, describe, expect, it } from "vitest";
import { claimBookingReminders, claimEventReminders, countConfirmedSeats } from "../src/queries";
import { contact, createMember, createOrganization, customerActor, db, testDeps } from "./helpers";

afterAll(() => db.$client.end());

describe("rappels de la veille", () => {
  it("réserve chaque rappel une seule fois, seulement pour les événements publiés de la fenêtre", async () => {
    const organizationId = await createOrganization("RAP");
    const owner = await createMember(organizationId);
    const deps = testDeps();
    const type = await createEventType(deps, owner, { name: "Atelier", color: "#D8BC66" });
    const create = async (title: string, startsAt: string) => {
      const [created] = await createEvent(deps, owner, {
        eventTypeId: type.id,
        title,
        startsAt,
        endsAt: startsAt.replace("T09", "T12"),
        timezone: "Europe/Paris",
        capacity: 10,
      });
      if (!created) throw new Error("Événement non créé");
      return created;
    };
    // Date lointaine et propre à ce test : la requête porte sur tous les espaces.
    const tomorrow = await publishEvent(
      deps,
      owner,
      (await create("Demain", "2031-03-06T09:00:00Z")).id,
    );
    await create("Brouillon", "2031-03-06T09:00:00Z");
    await publishEvent(deps, owner, (await create("Plus tard", "2031-03-09T09:00:00Z")).id);
    await createEventBooking(deps, customerActor(organizationId), {
      eventId: tomorrow.id,
      seats: 2,
      customer: contact(),
    });

    const window = [new Date("2031-03-05T21:00:00Z"), new Date("2031-03-06T09:00:00Z")] as const;
    const claimed = await claimEventReminders(db, ...window);
    expect(claimed.map((entry) => entry.title)).toEqual(["Demain"]);
    expect(await claimEventReminders(db, ...window)).toEqual([]);

    const later = new Date("2031-03-05T00:00:00Z");
    const bookings = await claimBookingReminders(db, tomorrow.id, later);
    expect(bookings.map((entry) => entry.seats)).toEqual([2]);
    expect(await claimBookingReminders(db, tomorrow.id, later)).toEqual([]);
    expect(await countConfirmedSeats(db, tomorrow.id)).toBe(2);
  });
});
