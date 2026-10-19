import {
  type Actor,
  cancelBooking,
  createCounterBooking,
  createEvent,
  createEventType,
  createItem,
  type Deps,
  publishEvent,
  removeEventItem,
  setEventItemQuantity,
} from "@horaya/core";
import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getBookingDetail, listCounterItems, listCustomers } from "../src/queries";
import { booking, customer, itemAllocation, payment } from "../src/schema";
import { createMember, createOrganization, db, fixedClock, testDeps } from "./helpers";

afterAll(() => db.$client.end());

let organizationId: string;
let owner: Actor;
let deps: Deps;

beforeEach(async () => {
  organizationId = await createOrganization();
  owner = await createMember(organizationId);
  deps = testDeps(fixedClock());
});

async function paddle(capacity = 8) {
  const type = await createEventType(deps, owner, { name: "Balade", color: "#D8BC66" });
  const [created] = await createEvent(deps, owner, {
    eventTypeId: type.id,
    title: "Balade paddle",
    startsAt: "2026-11-10T09:00:00Z",
    endsAt: "2026-11-10T10:30:00Z",
    timezone: "Europe/Paris",
    capacity,
    priceCents: 3500,
    paymentMode: "on_site",
  });
  if (!created) throw new Error("événement");
  return publishEvent(deps, owner, created.id);
}

const boards = (quantity = 4) =>
  createItem(deps, owner, { name: "Planche paddle", typeName: "Nautique", quantity });

const assigned = async (bookingId: string) =>
  (
    await db
      .select()
      .from(itemAllocation)
      .where(and(eq(itemAllocation.bookingId, bookingId), isNull(itemAllocation.cancelledAt)))
  ).length;

describe("comptoir", () => {
  it("note client sans e-mail, places, matériel et paiement en une fois", async () => {
    const event = await paddle();
    const item = await boards(4);
    // Une planche déjà prévue pour la séance : elle part en premier.
    await setEventItemQuantity(deps, owner, { eventId: event.id, itemId: item.id, quantity: 1 });

    const { booking: created, items } = await createCounterBooking(deps, owner, {
      eventId: event.id,
      seats: 2,
      customer: { firstName: "Camille", lastName: "Dupont", phone: "06 12 34 56 78", email: "" },
      items: [{ itemId: item.id, quantity: 2 }],
      paid: true,
      paymentMethod: "card",
    });

    expect(created).toMatchObject({
      status: "confirmed",
      source: "admin",
      amountCents: 7000,
      paymentStatus: "paid",
    });
    expect(items).toEqual([{ itemId: item.id, name: "Planche paddle", labels: ["#1", "#2"] }]);
    expect(await assigned(created.id)).toBe(2);
    const [person] = await db.select().from(customer).where(eq(customer.id, created.customerId));
    expect(person).toMatchObject({ email: null, phone: "06 12 34 56 78" });
    expect((await getBookingDetail(db, organizationId, created.id))?.assignedItems).toEqual([
      expect.objectContaining({ itemId: item.id, quantity: 2, units: "#1, #2" }),
    ]);
    const [paid] = await db.select().from(payment).where(eq(payment.bookingId, created.id));
    expect(paid).toMatchObject({ amountCents: 7000, provider: "manual", method: "card" });

    // Le matériel de la séance a grandi d'une planche ; 2 restent libres au stock.
    expect(await listCounterItems(db, organizationId, event.id)).toMatchObject([
      { id: item.id, free: 2, onEvent: 2 },
    ]);
    // Le téléphone se retrouve, même tapé autrement.
    expect(
      await listCustomers(db, organizationId, { segment: "all", now: new Date(), search: "0612" }),
    ).toHaveLength(1);
  });

  it("n'écrit rien s'il manque du matériel", async () => {
    const event = await paddle();
    const item = await boards(1);
    await expect(
      createCounterBooking(deps, owner, {
        eventId: event.id,
        seats: 1,
        customer: { firstName: "Léa", lastName: "Fontaine", phone: "0700000000" },
        items: [{ itemId: item.id, quantity: 2 }],
      }),
    ).rejects.toThrow("Planche paddle : il ne reste que 1 exemplaire pour cette séance");
    expect(await db.select().from(booking).where(eq(booking.eventId, event.id))).toHaveLength(0);
    expect(
      await db.select().from(customer).where(eq(customer.organizationId, organizationId)),
    ).toHaveLength(0);
  });

  it("rend le matériel à la séance quand la réservation est annulée", async () => {
    const event = await paddle();
    const item = await boards(2);
    const { booking: created } = await createCounterBooking(deps, owner, {
      eventId: event.id,
      seats: 1,
      customer: { firstName: "Théo", lastName: "Dupuis", email: "theo@mail.fr" },
      items: [{ itemId: item.id, quantity: 2 }],
    });
    // Attribuées à une réservation : la séance ne peut pas descendre en dessous, ni les retirer.
    await expect(
      setEventItemQuantity(deps, owner, { eventId: event.id, itemId: item.id, quantity: 1 }),
    ).rejects.toThrow("2 exemplaires sont attribués à des réservations");
    await expect(removeEventItem(deps, owner, event.id, item.id)).rejects.toThrow(
      "attribués à des réservations",
    );

    await cancelBooking(deps, owner, created.id);
    expect(await assigned(created.id)).toBe(0);
    expect(await listCounterItems(db, organizationId, event.id)).toMatchObject([
      { free: 2, onEvent: 2 },
    ]);
    await setEventItemQuantity(deps, owner, { eventId: event.id, itemId: item.id, quantity: 1 });
  });

  it("refuse matériel et paiement pour une réservation qui irait en liste d'attente", async () => {
    const event = await paddle(1);
    const item = await boards(2);
    await createCounterBooking(deps, owner, {
      eventId: event.id,
      seats: 1,
      customer: { firstName: "Ana", lastName: "Lopez", phone: "0611111111" },
    });
    await expect(
      createCounterBooking(deps, owner, {
        eventId: event.id,
        seats: 1,
        customer: { firstName: "Omar", lastName: "Haddad", phone: "0622222222" },
        items: [{ itemId: item.id, quantity: 1 }],
      }),
    ).rejects.toThrow();
  });

  it("exige un téléphone ou un e-mail pour un nouveau client", async () => {
    const event = await paddle();
    await expect(
      createCounterBooking(deps, owner, {
        eventId: event.id,
        seats: 1,
        customer: { firstName: "Sans", lastName: "Contact" },
      }),
    ).rejects.toThrow();
  });
});
