import {
  type Actor,
  createCounterBooking,
  createEvent,
  createEventBooking,
  createEventType,
  type Deps,
  type EventTypeField,
  publishEvent,
  updateEvent,
  updateEventType,
} from "@horaya/core";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getBookingDetail, getPublicEvent } from "../src/queries";
import { event as eventTable } from "../src/schema";
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

beforeEach(async () => {
  organizationId = await createOrganization();
  owner = member(organizationId);
  deps = testDeps(fixedClock());
});

/** Lot 33 : un type avec des champs de chaque portée. */
const FIELDS: EventTypeField[] = [
  {
    key: "niveau",
    label: "Niveau",
    type: "choice",
    scope: "event",
    required: true,
    options: ["Débutant", "Confirmé"],
    publicFilter: true,
  },
  {
    key: "pieces",
    label: "Pièces",
    type: "number",
    scope: "event",
    required: false,
    visibility: "internal",
  },
  { key: "deja", label: "Déjà tourné ?", type: "boolean", scope: "booking", required: true },
  {
    key: "depuis",
    label: "Depuis ?",
    type: "short_text",
    scope: "booking",
    required: true,
    condition: { fieldKey: "deja", equals: true },
  },
  { key: "reglement", label: "Règlement lu", type: "acceptance", scope: "booking", required: true },
  { key: "age", label: "Âge", type: "number", scope: "participant", required: true },
];

async function setup(day: number) {
  const type = await createEventType(deps, owner, {
    name: "Cours de tournage",
    color: "#A9663F",
    bookingNoun: "inscription",
    fields: FIELDS,
  });
  const [created] = await createEvent(deps, owner, {
    eventTypeId: type.id,
    title: "Tournage",
    startsAt: `2026-10-${day}T16:00:00Z`,
    endsAt: `2026-10-${day}T18:00:00Z`,
    timezone: "Europe/Paris",
    capacity: 10,
    fieldValues: { niveau: "Confirmé", pieces: "2" },
  });
  if (!created) throw new Error("événement");
  return { type, event: await publishEvent(deps, owner, created.id) };
}

describe("types sur mesure", () => {
  it("copie les champs sur l'événement et valide « Ce que tu décris »", async () => {
    const { type, event } = await setup(10);
    expect(event.fields).toEqual(FIELDS);
    expect(event.fieldValues).toEqual({ niveau: "Confirmé", pieces: 2 });
    await expect(
      createEvent(deps, owner, {
        eventTypeId: type.id,
        title: "Sans niveau",
        startsAt: "2026-10-12T16:00:00Z",
        endsAt: "2026-10-12T18:00:00Z",
        timezone: "Europe/Paris",
      }),
    ).rejects.toMatchObject({ issues: [{ path: "fieldValues.niveau", message: "Requis" }] });
    const updated = await updateEvent(deps, owner, event.id, {
      fieldValues: { niveau: "Débutant" },
    });
    expect(updated.fieldValues).toEqual({ niveau: "Débutant" });
  });

  it("ne montre jamais un champ interne sur la page publique", async () => {
    const { event } = await setup(10);
    const found = await getPublicEvent(db, organizationId, event.slug);
    expect(found?.fieldValues).toEqual({ niveau: "Confirmé" });
    expect(found?.fields.map((field) => field.key)).not.toContain("pieces");
    expect(found?.bookingNoun).toBe("inscription");
  });

  it("valide les réponses du client : requis, conditions, une ligne par place", async () => {
    const { event } = await setup(10);
    await expect(
      createEventBooking(deps, customerActor(organizationId), {
        eventId: event.id,
        seats: 2,
        customer: contact(),
        answers: { deja: "true" },
        participants: [{ firstName: "Léa", answers: { age: "14" } }],
      }),
    ).rejects.toMatchObject({
      issues: [
        { path: "answers.depuis", message: "Requis" },
        { path: "answers.reglement", message: "Coche la case pour continuer" },
        { path: "participants.1.answers.age", message: "Requis" },
      ],
    });

    const { booking } = await createEventBooking(deps, customerActor(organizationId), {
      eventId: event.id,
      seats: 2,
      customer: contact(),
      // « depuis » est masqué (« non ») : sa réponse est jetée.
      answers: { deja: "false", depuis: "3 ans", reglement: "on" },
      participants: [
        { firstName: "Léa", lastName: "Fontaine", answers: { age: "34" } },
        { answers: { age: "13" } },
      ],
    });
    expect(booking.answers).toEqual({ deja: false, reglement: "2026-10-01T08:00:00.000Z" });
    const detail = await getBookingDetail(db, organizationId, booking.id);
    expect(detail?.participants.map((entry) => [entry.firstName, entry.answers])).toEqual([
      ["Léa", { age: 34 }],
      ["", { age: 13 }],
    ]);
  });

  it("au comptoir, rien n'est requis et la première place est celle du client", async () => {
    const { event } = await setup(10);
    const { booking } = await createCounterBooking(deps, owner, {
      eventId: event.id,
      seats: 1,
      customer: { firstName: "Hugo", lastName: "Petit", phone: "0600000000" },
      answers: { deja: "true" },
    });
    expect(booking.answers).toEqual({ deja: true });
    const detail = await getBookingDetail(db, organizationId, booking.id);
    expect(detail?.participants).toMatchObject([{ firstName: "Hugo", lastName: "Petit" }]);
  });

  it("garde la version de chaque événement, sauf « Appliquer aussi » sans inscription", async () => {
    const { type, event: booked } = await setup(10);
    // Même type : un second événement à venir, sans inscription.
    const [free] = await createEvent(deps, owner, {
      eventTypeId: type.id,
      title: "Libre",
      startsAt: "2026-10-20T16:00:00Z",
      endsAt: "2026-10-20T18:00:00Z",
      timezone: "Europe/Paris",
      fieldValues: { niveau: "Débutant" },
    });
    await createEventBooking(deps, owner, {
      eventId: booked.id,
      seats: 1,
      customer: contact(),
    });
    const fewer = FIELDS.filter((field) => field.key !== "pieces");

    await updateEventType(deps, owner, type.id, { fields: fewer });
    const rows = () =>
      db
        .select({ id: eventTable.id, fields: eventTable.fields })
        .from(eventTable)
        .where(eq(eventTable.eventTypeId, type.id));
    for (const row of await rows()) expect(row.fields).toHaveLength(FIELDS.length);

    await updateEventType(deps, owner, type.id, { fields: fewer, applyToUpcoming: true });
    const after = new Map((await rows()).map((row) => [row.id, row.fields.length]));
    expect(after.get(booked.id)).toBe(FIELDS.length);
    expect(after.get(free?.id ?? "")).toBe(fewer.length);
  });
});
