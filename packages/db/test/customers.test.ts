import {
  type Actor,
  addCustomerNote,
  ConflictError,
  cancelBooking,
  createCustomer,
  createEvent,
  createEventBooking,
  createEventType,
  type Deps,
  ForbiddenError,
  publishEvent,
  updateCustomer,
} from "@horaya/core";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  countBookingsByTab,
  countCustomersBySegment,
  getBookingDetail,
  getCustomerDetail,
  getCustomerStats,
  listBookings,
  listCustomerBookings,
  listCustomers,
} from "../src/queries";
import { booking } from "../src/schema";
import {
  contact,
  createMember,
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
  owner = await createMember(organizationId);
  deps = testDeps(clock);
});

async function seed() {
  const type = await createEventType(deps, owner, {
    name: "Atelier",
    color: "#D8BC66",
    requiresApproval: true,
  });
  const [workshop] = await createEvent(deps, owner, {
    eventTypeId: type.id,
    title: "Atelier poterie",
    startsAt: "2026-10-20T09:00:00Z",
    endsAt: "2026-10-20T10:30:00Z",
    timezone: "Europe/Paris",
    capacity: 8,
    priceCents: 3500,
    paymentMode: "on_site",
  });
  if (!workshop) throw new Error("seed");
  await publishEvent(deps, owner, workshop.id);
  const camille = await createCustomer(deps, owner, {
    firstName: "Camille",
    lastName: "Roux",
    email: "camille.roux@mail.com",
    company: "Cabinet Vidal",
    tags: ["VIP"],
  });
  const { booking: pending } = await createEventBooking(deps, customerActor(organizationId), {
    eventId: workshop.id,
    seats: 2,
    customer: contact("Camille.Roux@mail.com"),
    customerMessage: "Faut-il apporter un tablier ?",
  });
  const { booking: confirmed } = await createEventBooking(deps, owner, {
    eventId: workshop.id,
    seats: 1,
    customer: { firstName: "Léa", lastName: "Fontaine", email: "lea@mail.com" },
  });
  const { booking: cancelled } = await createEventBooking(deps, owner, {
    eventId: workshop.id,
    seats: 1,
    customer: { firstName: "Marc", lastName: "Dupont", email: "marc@mail.com" },
  });
  await cancelBooking(deps, owner, cancelled.id);
  return { workshop, camille, pending, confirmed };
}

describe("clients", () => {
  it("crée un client, refuse un e-mail déjà pris et normalise les étiquettes", async () => {
    const created = await createCustomer(deps, owner, {
      firstName: "Hugo",
      lastName: "Petit",
      email: "Hugo.Petit@Mail.com",
      tags: ["VIP", "vip", "Entreprise"],
    });
    expect(created.email).toBe("hugo.petit@mail.com");
    expect(created.tags).toEqual(["vip", "entreprise"]);
    await expect(
      createCustomer(deps, owner, { firstName: "H", lastName: "P", email: "hugo.petit@mail.com" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("modifie sans écraser et ajoute une note interne", async () => {
    const { camille } = await seed();
    const updated = await updateCustomer(deps, owner, camille.id, { phone: "06 12 34 56 78" });
    expect(updated.company).toBe("Cabinet Vidal");
    expect(updated.phone).toBe("06 12 34 56 78");
    await addCustomerNote(deps, owner, camille.id, { body: "Réserve pour toute son équipe." });
    const detail = await getCustomerDetail(db, organizationId, camille.id, NOW);
    expect(detail?.notes.map((note) => [note.body, note.authorName])).toEqual([
      ["Réserve pour toute son équipe.", "Mohamed Ndoye"],
    ]);
  });

  it("interdit au lecteur de modifier un client", async () => {
    const { camille } = await seed();
    await expect(
      updateCustomer(deps, member(organizationId, "viewer"), camille.id, { phone: "0" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("liste les clients avec leurs chiffres et leurs segments", async () => {
    const { camille } = await seed();
    const rows = await listCustomers(db, organizationId, { segment: "all", now: NOW });
    const row = rows.find((entry) => entry.id === camille.id);
    expect(row).toMatchObject({ bookings: 1, spentCents: 0, company: "Cabinet Vidal" });
    expect(row?.nextVisit).toBeInstanceOf(Date);
    const segments = await countCustomersBySegment(db, organizationId, NOW);
    expect(segments).toMatchObject({ all: 3, vip: 1, company: 1, inactive: 0 });
    const stats = await getCustomerStats(db, organizationId, new Date("2026-10-01T00:00:00Z"));
    expect(stats).toMatchObject({ total: 3, averageBasketCents: 3500 });
  });
});

describe("réservations", () => {
  it("liste, filtre et compte les réservations", async () => {
    const { pending } = await seed();
    const all = await listBookings(db, organizationId, { tab: "all" });
    expect(all[0]?.id).toBe(pending.id);
    expect(await countBookingsByTab(db, organizationId)).toMatchObject({
      all: 3,
      pending: 1,
      confirmed: 1,
      cancelled: 1,
    });
    const searched = await listBookings(db, organizationId, { tab: "all", search: "fontaine" });
    expect(searched.map((row) => row.customerName)).toEqual(["Léa Fontaine"]);
  });

  it("donne la fiche d'une réservation avec son historique", async () => {
    const { pending, camille } = await seed();
    const detail = await getBookingDetail(db, organizationId, pending.id);
    expect(detail?.booking.customerMessage).toBe("Faut-il apporter un tablier ?");
    expect(detail?.booking.customer.id).toBe(camille.id);
    expect(detail?.activity.map((entry) => entry.action)).toEqual(["booking.created"]);
    expect(detail?.eventSeatsHeld).toBe(3);
    const history = await listCustomerBookings(db, organizationId, camille.id);
    expect(history).toHaveLength(1);
    expect(history[0]?.checkInUsed).toBe(false);
  });

  it("signale les événements dont l'équipe a fait le check-in", async () => {
    const { confirmed, camille } = await seed();
    await db.update(booking).set({ checkedInAt: new Date() }).where(eq(booking.id, confirmed.id));
    const [entry] = await listCustomerBookings(db, organizationId, camille.id);
    expect(entry?.checkInUsed).toBe(true);
    expect(entry?.checkedInAt).toBeNull();
  });
});
