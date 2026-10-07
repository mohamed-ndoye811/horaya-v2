import {
  type Actor,
  ConflictError,
  cancelBooking,
  cancelEvent,
  createEvent,
  createEventType,
  createItem,
  createRentalBooking,
  type Deps,
  importItems,
  publishEvent,
  scheduleMaintenance,
  setEventItemQuantity,
  setItemQuantity,
  updateEvent,
} from "@horaya/core";
import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  getBookingDetail,
  getInventoryStats,
  getItemDetail,
  listBookings,
  listCustomerBookings,
  listEventItems,
  listItems,
  listItemsAvailableBetween,
} from "../src/queries";
import { booking, itemAllocation, itemUnit } from "../src/schema";
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

async function projector(quantity = 3) {
  return createItem(deps, owner, {
    name: "Vidéoprojecteur Epson 4K",
    typeName: "Vidéo",
    quantity,
    dailyRateCents: 4500,
  });
}

async function seminar(day: number, title = "Séminaire") {
  const type = await createEventType(deps, owner, {
    name: `Type ${title} ${day}`,
    color: "#528D74",
  });
  const [created] = await createEvent(deps, owner, {
    eventTypeId: type.id,
    title,
    startsAt: `2026-11-${String(day).padStart(2, "0")}T08:00:00Z`,
    endsAt: `2026-11-${String(day).padStart(2, "0")}T16:00:00Z`,
    timezone: "Europe/Paris",
  });
  if (!created) throw new Error("événement");
  return publishEvent(deps, owner, created.id);
}

const activeCount = async (filter: { eventId?: string; bookingId?: string }) =>
  (
    await db
      .select()
      .from(itemAllocation)
      .where(
        and(
          isNull(itemAllocation.cancelledAt),
          filter.eventId ? eq(itemAllocation.eventId, filter.eventId) : undefined,
          filter.bookingId ? eq(itemAllocation.bookingId, filter.bookingId) : undefined,
        ),
      )
  ).length;

describe("articles", () => {
  it("génère des références lisibles et crée les exemplaires", async () => {
    const first = await projector(3);
    const second = await createItem(deps, owner, { name: "Vidéo Enceinte", quantity: 1 });
    expect([first.reference, second.reference]).toEqual(["VE-001", "VE-002"]);
    const units = await db.select().from(itemUnit).where(eq(itemUnit.itemId, first.id));
    expect(units.map((unit) => unit.label).sort()).toEqual(["#1", "#2", "#3"]);
    await expect(
      createItem(deps, owner, { name: "Autre", reference: "ve-001", quantity: 1 }),
    ).rejects.toThrow("La référence VE-001 est déjà utilisée");
  });
});

describe("matériel des événements", () => {
  it("ne prête jamais plus d'exemplaires qu'il n'y en a, même en simultané", async () => {
    const item = await projector(3);
    const [a, b] = await Promise.all([seminar(10, "Alpha"), seminar(10, "Bravo")]);
    const results = await Promise.allSettled([
      setEventItemQuantity(deps, owner, { eventId: a.id, itemId: item.id, quantity: 2 }),
      setEventItemQuantity(deps, owner, { eventId: b.id, itemId: item.id, quantity: 2 }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason).toBeInstanceOf(ConflictError);
    expect((await activeCount({ eventId: a.id })) + (await activeCount({ eventId: b.id }))).toBe(2);
  });

  it("ajuste la quantité et libère le matériel à l'annulation", async () => {
    const item = await projector(3);
    const event = await seminar(12);
    await setEventItemQuantity(deps, owner, { eventId: event.id, itemId: item.id, quantity: 3 });
    await setEventItemQuantity(deps, owner, { eventId: event.id, itemId: item.id, quantity: 1 });
    expect(await activeCount({ eventId: event.id })).toBe(1);
    await cancelEvent(deps, owner, event.id);
    expect(await activeCount({ eventId: event.id })).toBe(0);
  });

  it("déplace le matériel avec l'événement, ou refuse si les exemplaires sont pris", async () => {
    const item = await projector(1);
    const first = await seminar(14, "Premier");
    const second = await seminar(15, "Second");
    await setEventItemQuantity(deps, owner, { eventId: first.id, itemId: item.id, quantity: 1 });
    await setEventItemQuantity(deps, owner, { eventId: second.id, itemId: item.id, quantity: 1 });
    await expect(
      updateEvent(deps, owner, first.id, {
        startsAt: "2026-11-15T09:00:00Z",
        endsAt: "2026-11-15T12:00:00Z",
      }),
    ).rejects.toThrow("n'est pas libre sur les nouvelles dates");
    await updateEvent(deps, owner, first.id, {
      startsAt: "2026-11-13T09:00:00Z",
      endsAt: "2026-11-13T12:00:00Z",
    });
    const [moved] = await db
      .select()
      .from(itemAllocation)
      .where(and(eq(itemAllocation.eventId, first.id), isNull(itemAllocation.cancelledAt)));
    expect(moved?.startsAt.toISOString()).toBe("2026-11-13T09:00:00.000Z");
  });

  it("n'attribue pas un exemplaire en maintenance", async () => {
    const item = await projector(1);
    const [unit] = await db.select().from(itemUnit).where(eq(itemUnit.itemId, item.id));
    await scheduleMaintenance(deps, owner, {
      itemId: item.id,
      unitIds: [unit?.id ?? ""],
      startsAt: "2026-11-16T00:00:00Z",
      endsAt: "2026-11-18T00:00:00Z",
      title: "Révision lampe",
    });
    const event = await seminar(17);
    await expect(
      setEventItemQuantity(deps, owner, { eventId: event.id, itemId: item.id, quantity: 1 }),
    ).rejects.toThrow("Aucun exemplaire libre sur ces dates");
  });
});

describe("locations", () => {
  it("bloque les exemplaires loués et les libère à l'annulation", async () => {
    const item = await projector(2);
    const { bookingId } = await createRentalBooking(deps, owner, {
      itemId: item.id,
      quantity: 2,
      startsAt: "2026-11-20T08:00:00Z",
      endsAt: "2026-11-22T08:00:00Z",
      customer: { firstName: "Camille", lastName: "Roux", email: "camille@mail.com" },
    });
    expect(await activeCount({ bookingId })).toBe(2);
    await expect(
      createRentalBooking(deps, owner, {
        itemId: item.id,
        quantity: 1,
        startsAt: "2026-11-21T08:00:00Z",
        endsAt: "2026-11-21T18:00:00Z",
        customer: { firstName: "Léa", lastName: "Fontaine", email: "lea@mail.com" },
      }),
    ).rejects.toThrow("Aucun exemplaire libre");
    const cancelled = await cancelBooking(deps, owner, bookingId);
    expect(cancelled.status).toBe("cancelled");
    expect(await activeCount({ bookingId })).toBe(0);
  });

  it("refuse de retirer un exemplaire qui a une location à venir", async () => {
    const item = await projector(2);
    await createRentalBooking(deps, owner, {
      itemId: item.id,
      quantity: 2,
      startsAt: "2026-11-20T08:00:00Z",
      endsAt: "2026-11-20T18:00:00Z",
      customer: { firstName: "Camille", lastName: "Roux", email: "camille@mail.com" },
    });
    await expect(setItemQuantity(deps, owner, item.id, 1)).rejects.toThrow(
      "a des réservations à venir",
    );
    await setItemQuantity(deps, owner, item.id, 4);
    const units = await db.select().from(itemUnit).where(eq(itemUnit.itemId, item.id));
    expect(units).toHaveLength(4);
  });
  it("apparaît dans les réservations comme « Location · article »", async () => {
    const item = await projector(3);
    const { bookingId } = await createRentalBooking(deps, owner, {
      itemId: item.id,
      quantity: 2,
      startsAt: "2026-11-20T08:00:00Z",
      endsAt: "2026-11-21T10:00:00Z",
      customer: { firstName: "Camille", lastName: "Roux", email: "camille@mail.com" },
    });
    const [row] = await listBookings(db, organizationId, { tab: "all", search: "epson" });
    expect(row).toMatchObject({
      id: bookingId,
      eventId: null,
      eventTitle: "Location · Vidéoprojecteur Epson 4K",
      eventStartsAt: new Date("2026-11-20T08:00:00Z"),
      amountCents: 4500 * 2 * 2,
    });
    const detail = await getBookingDetail(db, organizationId, bookingId);
    expect(detail?.rentalItems).toEqual([
      expect.objectContaining({ itemId: item.id, quantity: 2, units: "#1, #2" }),
    ]);
    const customerId = detail?.booking.customer.id ?? "";
    expect(await listCustomerBookings(db, organizationId, customerId)).toHaveLength(1);
  });
});

describe("import CSV", () => {
  it("crée les articles et leurs exemplaires", async () => {
    const items = await importItems(
      deps,
      owner,
      "Nom;Référence;Catégorie;Quantité;Tarif par jour\nMicro HF;MIC-001;Son;2;12\nTable pliante;;Mobilier;6;\n",
    );
    expect(items.map((item) => item.reference)).toEqual(["MIC-001", expect.any(String)]);
    const units = await db
      .select()
      .from(itemUnit)
      .where(eq(itemUnit.itemId, items[1]?.id ?? ""));
    expect(units).toHaveLength(6);
  });

  it("n'importe rien si une ligne pose problème, et dit laquelle", async () => {
    await projector();
    const [existing] = await listItems(db, organizationId, { tab: "all", now: new Date() });
    await expect(
      importItems(deps, owner, `Nom;Référence\nMicro;MIC-002\nProjecteur;${existing?.reference}\n`),
    ).rejects.toThrow(`Ligne 3 : La référence ${existing?.reference} est déjà utilisée`);
    await expect(
      importItems(deps, owner, "Nom;Quantité;Location\nMicro;zéro;oui\nTable;1;peut-être\n"),
    ).rejects.toThrow(
      "Ligne 2 (Quantité) : Quantité invalide\nLigne 3 (Location) : oui ou non attendu",
    );
    expect(await listItems(db, organizationId, { tab: "all", now: new Date() })).toHaveLength(1);
  });
});

describe("revenus de location", () => {
  it("compare le mois en cours au mois dernier à la même date", async () => {
    const item = await projector(3);
    // La date d'une réservation est celle de sa création en base : on la fixe à la main.
    const rentOn = async (day: number, createdAt: string) => {
      const { bookingId } = await createRentalBooking(deps, owner, {
        itemId: item.id,
        quantity: 1,
        startsAt: `2026-11-${day}T08:00:00Z`,
        endsAt: `2026-11-${day}T18:00:00Z`,
        customer: { firstName: "Camille", lastName: "Roux", email: "camille@mail.com" },
      });
      await db
        .update(booking)
        .set({ createdAt: new Date(createdAt) })
        .where(eq(booking.id, bookingId));
    };
    await rentOn(10, "2026-09-03T10:00:00Z"); // compte : avant le 5 septembre
    await rentOn(11, "2026-09-20T10:00:00Z"); // ne compte pas : après la même date
    await rentOn(12, "2026-10-02T10:00:00Z");
    await rentOn(13, "2026-10-04T10:00:00Z");

    const stats = await getInventoryStats(db, organizationId, {
      now: new Date("2026-10-05T10:00:00Z"),
      dayEnd: new Date("2026-10-05T22:00:00Z"),
      monthStart: new Date("2026-10-01T00:00:00Z"),
      previousMonthStart: new Date("2026-09-01T00:00:00Z"),
    });
    // Même tarif pour chaque location : deux ce mois-ci, une seule le mois dernier à date.
    expect(stats.previousRentalRevenueCents).toBeGreaterThan(0);
    expect(stats.rentalRevenueCents).toBe(stats.previousRentalRevenueCents * 2);
  });
});

describe("lectures du matériel", () => {
  it("résume l'inventaire, la fiche article et le matériel d'un événement", async () => {
    const item = await projector(3);
    const event = await seminar(10);
    await setEventItemQuantity(deps, owner, { eventId: event.id, itemId: item.id, quantity: 2 });
    const [unit] = await db.select().from(itemUnit).where(eq(itemUnit.itemId, item.id));
    await scheduleMaintenance(deps, owner, {
      itemId: item.id,
      unitIds: [unit?.id ?? ""],
      startsAt: "2026-09-30T00:00:00Z",
      endsAt: "2026-10-02T00:00:00Z",
      title: "Nettoyage filtres",
    });
    const now = new Date("2026-10-01T08:00:00Z");

    const [row] = await listItems(db, organizationId, { tab: "all", now });
    expect(row).toMatchObject({
      units: 3,
      availableNow: 2,
      inMaintenanceNow: 1,
      typeName: "Vidéo",
      nextKind: "maintenance",
    });
    expect(row?.nextStartsAt).toBeInstanceOf(Date);
    expect(await listItems(db, organizationId, { tab: "maintenance", now })).toHaveLength(1);

    const detail = await getItemDetail(db, organizationId, item.id, {
      from: new Date("2026-11-09T00:00:00Z"),
      to: new Date("2026-11-12T00:00:00Z"),
      now,
    });
    expect(detail?.units.map((entry) => entry.label)).toEqual(["#1", "#2", "#3"]);
    expect(detail?.planning.map((entry) => [entry.kind, entry.eventTitle])).toEqual([
      ["event", "Séminaire"],
      ["event", "Séminaire"],
    ]);
    expect(detail?.maintenance.map((entry) => entry.title)).toEqual(["Nettoyage filtres"]);

    expect(await listEventItems(db, organizationId, event.id)).toMatchObject([
      { name: "Vidéoprojecteur Epson 4K", quantity: 2 },
    ]);
    const available = await listItemsAvailableBetween(db, organizationId, {
      startsAt: event.startsAt,
      endsAt: event.endsAt,
    });
    expect(available).toMatchObject([{ units: 3, free: 1 }]);
    const ignoringEvent = await listItemsAvailableBetween(
      db,
      organizationId,
      { startsAt: event.startsAt, endsAt: event.endsAt },
      event.id,
    );
    expect(ignoringEvent).toMatchObject([{ free: 3 }]);

    const stats = await getInventoryStats(db, organizationId, {
      now,
      dayEnd: new Date("2026-10-01T22:00:00Z"),
      monthStart: new Date("2026-10-01T00:00:00Z"),
      previousMonthStart: new Date("2026-09-01T00:00:00Z"),
    });
    expect(stats).toMatchObject({ items: 1, types: 1, maintenanceUnits: 1 });
  });
});
