import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type Actor,
  createCounterBooking,
  createEvent,
  createEventBooking,
  createEventType,
  createPassPlan,
  type Deps,
  type EventModules,
  type PaymentMode,
  publishEvent,
  quoteBooking,
  sellPass,
  updateEventType,
} from "@horaya/core";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { listCustomerPasses } from "../src/queries";
import { customer, event as eventTable } from "../src/schema";
import { contact, createMember, createOrganization, db, fixedClock, testDeps } from "./helpers";

afterAll(() => db.$client.end());

/** Les requêtes de reprise de la migration 0025, jouées sur des tables qui ont les anciennes colonnes. */
const reprise = readFileSync(join(import.meta.dirname, "../migrations/0025_argent.sql"), "utf8")
  .split("--> statement-breakpoint")
  .map((statement) => statement.trim())
  .filter((statement) => statement.includes("UPDATE"));

/** Prix d'avant le lot 35 (ancien `priceBooking`). */
const legacyPrice = (priceCents: number, depositPercent: number | null, seats: number) => {
  const amountCents = priceCents * seats;
  return {
    amountCents,
    depositCents: depositPercent === null ? null : Math.round((amountCents * depositPercent) / 100),
  };
};

describe("reprise des données (migration 0025)", () => {
  it("un type payant a un tarif « Plein » unique, un type gratuit aucun", async () => {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(sql`create temp table "legacy_type" (
        "id" int primary key, "default_price_cents" int, "modules" jsonb not null
      ) on commit drop`);
      await tx.execute(sql`insert into "legacy_type" values
        (1, 4500, '{"waitlist": {}}'), (2, null, '{}'), (3, 0, '{}')`);
      for (const statement of reprise.filter((entry) => entry.includes('"event_type"'))) {
        await tx.execute(sql.raw(statement.replaceAll('"event_type"', '"legacy_type"')));
      }
      return tx.execute<{ modules: EventModules }>(
        sql`select "modules" from "legacy_type" order by "id"`,
      );
    });
    expect(rows.map((row) => row.modules)).toEqual([
      { waitlist: {}, pricing: { rates: [{ id: "plein", name: "Plein", priceCents: 4500 }] } },
      {},
      {},
    ]);
  });

  it("chaque événement garde exactement son prix et son acompte", async () => {
    const cases: Array<[number, PaymentMode, number | null]> = [
      [0, "free", null],
      [3500, "on_site", null],
      [4500, "online", null],
      [8500, "deposit", 30],
      [3333, "deposit", 33],
      [12000, "deposit", 100],
    ];
    const rows = await db.transaction(async (tx) => {
      await tx.execute(sql`create temp table "legacy_event" (
        "id" int primary key, "price_cents" int not null, "payment_mode" text not null,
        "deposit_percent" int, "modules" jsonb not null default '{}'::jsonb
      ) on commit drop`);
      for (const [index, [price, mode, deposit]] of cases.entries()) {
        await tx.execute(
          sql`insert into "legacy_event" values (${index}, ${price}, ${mode}, ${deposit})`,
        );
      }
      for (const statement of reprise.filter((entry) => entry.includes('UPDATE "event" '))) {
        await tx.execute(sql.raw(statement.replaceAll('"event"', '"legacy_event"')));
      }
      return tx.execute<{ price_cents: number; payment_mode: PaymentMode; modules: EventModules }>(
        sql`select "price_cents", "payment_mode", "modules" from "legacy_event" order by "id"`,
      );
    });

    expect(rows[0]?.modules).toEqual({});
    expect(rows[1]?.modules.pricing).toEqual({
      rates: [{ id: "plein", name: "Plein", priceCents: 3500 }],
    });
    expect(rows[3]?.modules.deposit).toEqual({ percent: 30, balance: "on_site" });
    // Un acompte de 100 % devient un paiement en ligne du tout.
    expect(rows[5]).toMatchObject({
      payment_mode: "online",
      modules: { pricing: expect.anything() },
    });
    expect(rows[5]?.modules.deposit).toBeUndefined();

    for (const [index, [price, , deposit]] of cases.entries()) {
      const row = rows[index];
      if (!row) throw new Error("ligne");
      for (const seats of [1, 2, 3]) {
        const quote = quoteBooking(
          { priceCents: row.price_cents, paymentMode: row.payment_mode, modules: row.modules },
          seats,
        );
        const before = legacyPrice(price, deposit === 100 ? null : deposit, seats);
        expect(quote.amountCents, `cas ${index}, ${seats} places`).toBe(before.amountCents);
        expect(quote.depositCents, `cas ${index}, ${seats} places`).toBe(
          deposit === 100 ? null : before.depositCents,
        );
      }
    }
  });
});

describe("tarifs, options, acompte et moyens acceptés", () => {
  let organizationId: string;
  let owner: Actor;
  let deps: Deps;
  const modules: EventModules = {
    pricing: {
      rates: [
        { id: "plein", name: "Plein", priceCents: 4500 },
        { id: "reduit", name: "Réduit", priceCents: 3500 },
      ],
      options: [
        { id: "cuisson", name: "Cuisson et émaillage", priceCents: 800, per: "participant" },
      ],
    },
    deposit: { percent: 30 },
  };

  beforeEach(async () => {
    organizationId = await createOrganization();
    owner = await createMember(organizationId);
    deps = testDeps(fixedClock());
  });

  async function session(typeModules: EventModules, extra: object = {}) {
    const type = await createEventType(deps, owner, {
      name: `Tournage ${Math.random()}`,
      color: "#A9663F",
      modules: typeModules,
    });
    const [created] = await createEvent(deps, owner, {
      eventTypeId: type.id,
      title: "Cours de tournage",
      startsAt: "2026-11-10T17:00:00Z",
      endsAt: "2026-11-10T19:00:00Z",
      timezone: "Europe/Paris",
      capacity: 8,
      priceCents: 1,
      paymentMode: "deposit",
      ...extra,
    });
    if (!created) throw new Error("événement");
    return { type, event: await publishEvent(deps, owner, created.id) };
  }

  it("le type donne son prix par défaut, l'événement ses prix ; la réservation garde son détail", async () => {
    const { type, event } = await session(modules, { prices: { plein: 5000 } });
    expect(type.defaultPriceCents).toBe(4500);
    expect(event.priceCents).toBe(5000);
    expect(event.modules.deposit).toEqual({ percent: 30 });

    const { booking } = await createEventBooking(deps, owner, {
      eventId: event.id,
      seats: 2,
      customer: contact(),
      rates: ["plein", "reduit"],
      options: { cuisson: 2 },
    });
    expect(booking.amountCents).toBe(5000 + 3500 + 1600);
    expect(booking.depositCents).toBe(3030);
    expect(booking.priceLines.map((line) => [line.id, line.quantity, line.totalCents])).toEqual([
      ["plein", 1, 5000],
      ["reduit", 1, 3500],
      ["cuisson", 2, 1600],
    ]);
  });

  it("refuse un tarif inconnu", async () => {
    const { event } = await session(modules);
    await expect(
      createEventBooking(deps, owner, {
        eventId: event.id,
        seats: 1,
        customer: contact(),
        rates: ["vip"],
      }),
    ).rejects.toThrow(/tarif/);
  });

  it("« Appliquer aux événements à venir » garde l'acompte de chaque événement", async () => {
    const { type, event } = await session(modules);
    await updateEventType(deps, owner, type.id, {
      modules: { pricing: { rates: [{ id: "plein", name: "Plein", priceCents: 6000 }] } },
      applyToUpcoming: true,
    });
    const [after] = await db.select().from(eventTable).where(eq(eventTable.id, event.id));
    expect(after?.priceCents).toBe(6000);
    expect(after?.modules.deposit).toEqual({ percent: 30 });
    expect(after?.modules.pricing?.rates).toHaveLength(1);
  });

  it("bons cadeaux refusés par le type : le code n'est pas accepté", async () => {
    const { event } = await session({ ...modules, payment_methods: { giftCards: false } });
    await expect(
      createEventBooking(deps, owner, {
        eventId: event.id,
        seats: 1,
        customer: contact(),
        giftCardCode: "TERRE-ABCD2345",
      }),
    ).rejects.toThrow(/bons cadeaux ne sont pas acceptés/);
  });

  it("cartes : seulement les formules choisies, avec le nombre de séances par place", async () => {
    const plan = (name: string) =>
      createPassPlan(deps, owner, {
        name,
        sessions: 10,
        priceCents: 30000,
        validityDays: 90,
        eventTypeIds: [],
      });
    const [accepted, other] = [await plan("Carte 10"), await plan("Carte atelier")];
    const { event } = await session(
      { ...modules, payment_methods: { passPlanIds: [accepted.id], sessionsPerSeat: 2 } },
      { paymentMode: "on_site" },
    );
    const [client] = await db
      .insert(customer)
      .values({ organizationId, firstName: "Camille", lastName: "Roux", email: "c@mail.com" })
      .returning();
    if (!client) throw new Error("client");
    const sell = (planId: string) =>
      sellPass(deps, owner, { customerId: client.id, planId, paid: true });
    const good = await sell(accepted.id);
    const bad = await sell(other.id);

    await expect(
      createCounterBooking(deps, owner, {
        eventId: event.id,
        seats: 1,
        customerId: client.id,
        passId: bad.id,
      }),
    ).rejects.toThrow(/ne s'utilise pas/);
    await createCounterBooking(deps, owner, {
      eventId: event.id,
      seats: 2,
      customerId: client.id,
      passId: good.id,
    });
    const passes = await listCustomerPasses(db, organizationId, client.id);
    expect(passes.find((entry) => entry.id === good.id)?.balance).toBe(6);
  });
});
