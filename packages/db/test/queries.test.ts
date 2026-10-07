import {
  type Actor,
  cancelBooking,
  createEvent,
  createEventBooking,
  createEventType,
  type Deps,
  publishEvent,
} from "@horaya/core";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  countEventsByTab,
  getDashboardStats,
  getEventDetail,
  listEvents,
  listEventsInRange,
  listEventTypes,
  listLatestBookings,
} from "../src/queries";
import {
  contact,
  createOrganization,
  customerActor,
  db,
  fixedClock,
  member,
  testDeps,
} from "./helpers";

afterAll(() => db.$client.end());

let organizationId: string;
let owner: Actor;
let deps: Deps;
const clock = fixedClock(new Date("2026-10-01T08:00:00Z"));
const NOW = clock.now();

beforeEach(async () => {
  organizationId = await createOrganization();
  owner = member(organizationId);
  deps = testDeps(clock);
});

async function seed() {
  const seminar = await createEventType(deps, owner, { name: "Séminaire", color: "#528D74" });
  const workshop = await createEventType(deps, owner, { name: "Atelier", color: "#D8BC66" });
  const [annual] = await createEvent(deps, owner, {
    eventTypeId: seminar.id,
    title: "Séminaire annuel",
    startsAt: "2026-10-15T12:00:00Z",
    endsAt: "2026-10-16T14:30:00Z",
    timezone: "Europe/Paris",
    capacity: 10,
    priceCents: 12000,
    paymentMode: "on_site",
    locationName: "Salle Horizon",
  });
  const [pottery] = await createEvent(deps, owner, {
    eventTypeId: workshop.id,
    title: "Atelier poterie",
    startsAt: "2026-10-20T09:00:00Z",
    endsAt: "2026-10-20T10:30:00Z",
    timezone: "Europe/Paris",
  });
  if (!annual || !pottery) throw new Error("seed");
  await publishEvent(deps, owner, annual.id);
  const { booking: first } = await createEventBooking(deps, owner, {
    eventId: annual.id,
    seats: 3,
    customer: contact("a@mail.com"),
  });
  await createEventBooking(deps, customerActor(organizationId), {
    eventId: annual.id,
    seats: 2,
    customer: contact("b@mail.com"),
  });
  const { booking: cancelled } = await createEventBooking(deps, owner, {
    eventId: annual.id,
    seats: 1,
    customer: contact("c@mail.com"),
  });
  await cancelBooking(deps, owner, cancelled.id);
  return { annual, pottery, first, seminar };
}

describe("requêtes de lecture", () => {
  it("liste les événements par onglet avec les places occupées", async () => {
    const { annual } = await seed();
    const published = await listEvents(db, organizationId, { tab: "published", now: NOW });
    expect(published.map((row) => [row.title, row.seatsHeld, row.typeName])).toEqual([
      ["Séminaire annuel", 5, "Séminaire"],
    ]);
    expect(await countEventsByTab(db, organizationId, NOW)).toEqual({
      all: 2,
      published: 1,
      draft: 1,
      past: 0,
    });
    const searched = await listEvents(db, organizationId, {
      tab: "all",
      now: NOW,
      search: "horizon",
    });
    expect(searched.map((row) => row.id)).toEqual([annual.id]);
  });

  it("ne renvoie que les événements de la période demandée", async () => {
    await seed();
    const rows = await listEventsInRange(db, organizationId, {
      from: new Date("2026-10-16T00:00:00Z"),
      to: new Date("2026-10-19T00:00:00Z"),
    });
    expect(rows.map((row) => row.title)).toEqual(["Séminaire annuel"]);
  });

  it("donne la fiche d'un événement avec ses réservations", async () => {
    const { annual } = await seed();
    const detail = await getEventDetail(db, organizationId, annual.id);
    expect(detail?.event.seatsHeld).toBe(5);
    expect(detail?.bookings).toHaveLength(3);
    expect(detail?.bookedAmountCents).toBe(60000);
  });

  it("compte les types et les chiffres du tableau de bord", async () => {
    await seed();
    const types = await listEventTypes(db, organizationId);
    expect(types.map((type) => [type.name, type.eventCount])).toEqual([
      ["Atelier", 1],
      ["Séminaire", 1],
    ]);
    const stats = await getDashboardStats(db, organizationId, {
      now: NOW,
      weekStart: new Date("2026-10-12T00:00:00Z"),
      weekEnd: new Date("2026-10-19T00:00:00Z"),
      previousWeekStart: new Date("2026-10-05T00:00:00Z"),
      monthStart: new Date("2026-10-01T00:00:00Z"),
    });
    expect(stats).toMatchObject({ eventsThisWeek: 1, activeBookings: 2, fillRate: 50 });
    expect((await listLatestBookings(db, organizationId)).map((row) => row.status)).toContain(
      "cancelled",
    );
  });
});
