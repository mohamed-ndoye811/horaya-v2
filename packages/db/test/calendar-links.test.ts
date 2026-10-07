import {
  type Actor,
  createCalendarLink,
  createEvent,
  createEventBooking,
  createEventType,
  type Deps,
  deleteCalendarLink,
  ForbiddenError,
  publishEvent,
  updateCalendarLink,
} from "@horaya/core";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  getPublicCalendarLink,
  getPublicEvent,
  listCalendarLinkEvents,
  listCalendarLinks,
} from "../src/queries";
import { contact, createOrganization, customerActor, db, member, testDeps } from "./helpers";

afterAll(() => db.$client.end());

let organizationId: string;
let owner: Actor;
let deps: Deps;
const now = new Date("2026-10-01T08:00:00Z");

beforeEach(async () => {
  organizationId = await createOrganization();
  owner = member(organizationId);
  deps = testDeps();
});

async function published(title: string, typeId: string, visibility: "public" | "invite_only") {
  const [created] = await createEvent(deps, owner, {
    eventTypeId: typeId,
    title,
    startsAt: "2026-11-10T09:00:00Z",
    endsAt: "2026-11-10T12:00:00Z",
    timezone: "Europe/Paris",
    capacity: 10,
    visibility,
  });
  if (!created) throw new Error("Événement non créé");
  return publishEvent(deps, owner, created.id);
}

async function seed() {
  const workshop = await createEventType(deps, owner, { name: "Atelier", color: "#D8BC66" });
  const seminar = await createEventType(deps, owner, { name: "Séminaire", color: "#528D74" });
  const open = await published("Atelier ouvert", workshop.id, "public");
  const privateWorkshop = await published("Atelier privé", workshop.id, "invite_only");
  const privateSeminar = await published("Séminaire privé", seminar.id, "invite_only");
  return { workshop, seminar, open, privateWorkshop, privateSeminar };
}

const bookAs = (eventId: string, calendarLinkSlug?: string) =>
  createEventBooking(deps, customerActor(organizationId), {
    eventId,
    seats: 1,
    customer: contact(),
    calendarLinkSlug,
  });

describe("liens calendrier", () => {
  it("montrent les événements choisis, « sur invitation » compris", async () => {
    const { workshop, open, privateWorkshop, privateSeminar } = await seed();
    const link = await createCalendarLink(deps, owner, {
      name: "Ateliers équipe Vidal",
      filterMode: "event_types",
      filterIds: [workshop.id],
    });
    expect(link.slug).toMatch(/^ateliers-equipe-vidal-[a-z2-9]{10}$/);

    const events = await listCalendarLinkEvents(db, link, now);
    expect(events.map((entry) => entry.title).sort()).toEqual(["Atelier ouvert", "Atelier privé"]);

    // Sans le lien, l'événement privé reste caché ; avec, il s'affiche.
    expect(await getPublicEvent(db, organizationId, privateWorkshop.slug)).toBeNull();
    expect(await getPublicEvent(db, organizationId, privateWorkshop.slug, link)).not.toBeNull();
    expect(await getPublicEvent(db, organizationId, privateSeminar.slug, link)).toBeNull();
    expect(await getPublicEvent(db, organizationId, open.slug, link)).not.toBeNull();

    const [listed] = await listCalendarLinks(db, organizationId, now);
    expect(listed).toMatchObject({ name: "Ateliers équipe Vidal", upcomingEvents: 2 });
  });

  it("valent invitation pour réserver, seulement pour leurs événements et tant qu'ils sont actifs", async () => {
    const { privateWorkshop, privateSeminar } = await seed();
    const link = await createCalendarLink(deps, owner, {
      name: "Atelier privé",
      filterMode: "events",
      filterIds: [privateWorkshop.id],
    });

    await expect(bookAs(privateWorkshop.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(bookAs(privateSeminar.id, link.slug)).rejects.toBeInstanceOf(ForbiddenError);
    const { booking } = await bookAs(privateWorkshop.id, link.slug);
    expect(booking.status).toBe("confirmed");

    await updateCalendarLink(deps, owner, link.id, { isActive: false });
    expect(await getPublicCalendarLink(db, organizationId, link.slug)).toBeNull();
    await expect(bookAs(privateWorkshop.id, link.slug)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refusent des événements d'un autre espace et gardent leur adresse quand on les renomme", async () => {
    const { open } = await seed();
    const otherOrganization = await createOrganization();
    const otherOwner = member(otherOrganization);
    await expect(
      createCalendarLink(testDeps(), otherOwner, {
        name: "Volé",
        filterMode: "events",
        filterIds: [open.id],
      }),
    ).rejects.toThrow("Données invalides");

    const link = await createCalendarLink(deps, owner, {
      name: "Tout",
      filterMode: "all",
      filterIds: [],
    });
    const renamed = await updateCalendarLink(deps, owner, link.id, { name: "Tout le programme" });
    expect(renamed.slug).toBe(link.slug);
    await deleteCalendarLink(deps, owner, link.id);
    expect(await listCalendarLinks(db, organizationId, now)).toEqual([]);
  });
});
