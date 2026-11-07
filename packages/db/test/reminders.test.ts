import { createEvent, createEventBooking, createEventType, publishEvent } from "@horaya/core";
import { afterAll, describe, expect, it } from "vitest";
import {
  claimAlmostFull,
  claimBookingReminders,
  claimEventReminders,
  claimWeeklyDigests,
  countConfirmedSeats,
  getWeeklyDigest,
} from "../src/queries";
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

describe("notifications à l'équipe", () => {
  it("prévient une seule fois quand 80 % de la jauge est prise", async () => {
    const organizationId = await createOrganization("PLE");
    const owner = await createMember(organizationId);
    const deps = testDeps();
    const type = await createEventType(deps, owner, { name: "Atelier", color: "#D8BC66" });
    const [created] = await createEvent(deps, owner, {
      eventTypeId: type.id,
      title: "Atelier",
      startsAt: "2031-04-01T09:00:00Z",
      endsAt: "2031-04-01T12:00:00Z",
      timezone: "Europe/Paris",
      capacity: 10,
    });
    if (!created) throw new Error("Événement non créé");
    await publishEvent(deps, owner, created.id);
    const book = (seats: number) =>
      createEventBooking(deps, customerActor(organizationId), {
        eventId: created.id,
        seats,
        customer: contact(),
      });

    await book(7);
    expect(await claimAlmostFull(db, created.id)).toBeNull();
    await book(1);
    expect(await claimAlmostFull(db, created.id)).toMatchObject({ seats: 8, capacity: 10 });
    expect(await claimAlmostFull(db, created.id)).toBeNull();
  });

  it("envoie le récap le lundi à partir de 8 h, une fois par semaine", async () => {
    const organizationId = await createOrganization("HEB");
    const claimed = async (now: string) =>
      (await claimWeeklyDigests(db, new Date(now))).some(
        (entry) => entry.organizationId === organizationId,
      );
    expect(await claimed("2031-03-09T10:00:00Z")).toBe(false); // dimanche
    expect(await claimed("2031-03-10T06:30:00Z")).toBe(false); // lundi 7 h 30 à Paris
    expect(await claimed("2031-03-10T07:30:00Z")).toBe(true); // lundi 8 h 30 à Paris
    expect(await claimed("2031-03-10T09:00:00Z")).toBe(false);
    expect(await claimed("2031-03-17T07:30:00Z")).toBe(true);
  });

  it("compte la semaine écoulée et les événements des 7 prochains jours", async () => {
    const organizationId = await createOrganization("REC");
    const owner = await createMember(organizationId);
    const deps = testDeps();
    const type = await createEventType(deps, owner, { name: "Atelier", color: "#D8BC66" });
    const inTwoDays = new Date(Date.now() + 2 * 86_400_000);
    inTwoDays.setUTCMinutes(0, 0, 0);
    const [created] = await createEvent(deps, owner, {
      eventTypeId: type.id,
      title: "Bientôt",
      startsAt: inTwoDays.toISOString(),
      endsAt: new Date(inTwoDays.getTime() + 3_600_000).toISOString(),
      timezone: "Europe/Paris",
      capacity: 10,
    });
    if (!created) throw new Error("Événement non créé");
    await publishEvent(deps, owner, created.id);
    await createEventBooking(deps, customerActor(organizationId), {
      eventId: created.id,
      seats: 3,
      customer: contact(),
    });

    const digest = await getWeeklyDigest(db, organizationId, new Date());
    expect(digest).toMatchObject({ bookings: 1, seats: 3, cancelled: 0, pending: 0 });
    expect(digest.upcoming).toEqual([
      expect.objectContaining({ title: "Bientôt", seats: 3, capacity: 10 }),
    ]);
  });
});
