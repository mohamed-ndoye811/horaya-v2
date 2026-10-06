import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDb } from "../src/client";
import {
  booking,
  customer,
  event,
  eventType,
  item,
  itemAllocation,
  itemUnit,
  organization,
} from "../src/schema";

const db = createDb(process.env.TEST_DATABASE_URL ?? "");
afterAll(() => db.$client.end());

/** Code SQLSTATE de l'erreur Postgres sous-jacente (Drizzle l'enveloppe dans `cause`). */
async function sqlState(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    const cause = (error as { cause?: { code?: string } }).cause;
    return cause?.code ?? (error as { code?: string }).code;
  }
  return undefined;
}

const EXCLUSION_VIOLATION = "23P01";
const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";

/** Première ligne d'un `returning()`, sans assertion non nulle. */
function first<T>(rows: T[]): T {
  const [row] = rows;
  if (!row) throw new Error("Insertion sans ligne retournée");
  return row;
}

const at = (day: number, hour = 9) => new Date(Date.UTC(2026, 5, day, hour));

let organizationId: string;

beforeEach(async () => {
  organizationId = randomUUID();
  await db.insert(organization).values({
    id: organizationId,
    name: "Cabinet Vidal",
    slug: `cabinet-vidal-${organizationId.slice(0, 8)}`,
    createdAt: new Date(),
  });
});

async function createUnit() {
  const created = first(
    await db
      .insert(item)
      .values({ organizationId, name: "Vidéoprojecteur Epson 4K", reference: `VP-${randomUUID()}` })
      .returning(),
  );
  return first(
    await db
      .insert(itemUnit)
      .values({ organizationId, itemId: created.id, label: "#1" })
      .returning(),
  );
}

describe("item_allocation : un exemplaire n'est jamais occupé deux fois", () => {
  it("refuse une allocation qui chevauche une autre sur le même exemplaire", async () => {
    const unit = await createUnit();
    await db.insert(itemAllocation).values({
      organizationId,
      itemUnitId: unit.id,
      kind: "block",
      startsAt: at(18),
      endsAt: at(21),
    });

    const overlapping = db.insert(itemAllocation).values({
      organizationId,
      itemUnitId: unit.id,
      kind: "maintenance",
      startsAt: at(20),
      endsAt: at(24),
    });

    expect(await sqlState(overlapping)).toBe(EXCLUSION_VIOLATION);
  });

  it("autorise deux périodes bout à bout", async () => {
    const unit = await createUnit();
    await db.insert(itemAllocation).values({
      organizationId,
      itemUnitId: unit.id,
      kind: "block",
      startsAt: at(18, 9),
      endsAt: at(18, 12),
    });

    const backToBack = db.insert(itemAllocation).values({
      organizationId,
      itemUnitId: unit.id,
      kind: "block",
      startsAt: at(18, 12),
      endsAt: at(18, 18),
    });

    expect(await sqlState(backToBack)).toBeUndefined();
  });

  it("libère le créneau quand l'allocation est annulée", async () => {
    const unit = await createUnit();
    await db.insert(itemAllocation).values({
      organizationId,
      itemUnitId: unit.id,
      kind: "block",
      startsAt: at(18),
      endsAt: at(21),
      cancelledAt: new Date(),
    });

    const sameSlot = db.insert(itemAllocation).values({
      organizationId,
      itemUnitId: unit.id,
      kind: "block",
      startsAt: at(18),
      endsAt: at(21),
    });

    expect(await sqlState(sameSlot)).toBeUndefined();
  });
});

describe("booking : cohérence garantie par la base", () => {
  async function createCustomer(email = "camille.roux@mail.com") {
    return first(
      await db
        .insert(customer)
        .values({ organizationId, firstName: "Camille", lastName: "Roux", email })
        .returning(),
    );
  }

  it("refuse une réservation d'événement sans événement", async () => {
    const client = await createCustomer();
    const orphan = db.insert(booking).values({
      organizationId,
      reference: "HRY-2606-0001",
      kind: "event",
      customerId: client.id,
      status: "pending",
      source: "admin",
    });
    expect(await sqlState(orphan)).toBe(CHECK_VIOLATION);
  });

  it("refuse une location dont la fin précède le début", async () => {
    const client = await createCustomer();
    const invalid = db.insert(booking).values({
      organizationId,
      reference: "HRY-2606-0002",
      kind: "rental",
      customerId: client.id,
      status: "pending",
      source: "public_page",
      rentalStartsAt: at(20),
      rentalEndsAt: at(18),
    });
    expect(await sqlState(invalid)).toBe(CHECK_VIOLATION);
  });

  it("accepte une réservation valide sur un événement publié", async () => {
    const client = await createCustomer();
    const type = first(
      await db
        .insert(eventType)
        .values({ organizationId, name: "Séminaire", color: "#528D74" })
        .returning(),
    );
    const seminar = first(
      await db
        .insert(event)
        .values({
          organizationId,
          eventTypeId: type.id,
          title: "Séminaire annuel",
          slug: "seminaire-annuel",
          status: "published",
          startsAt: at(15, 14),
          endsAt: at(16, 16),
          timezone: "Europe/Paris",
          capacity: 50,
          priceCents: 12000,
        })
        .returning(),
    );

    const valid = db.insert(booking).values({
      organizationId,
      reference: "HRY-2606-0003",
      eventId: seminar.id,
      customerId: client.id,
      seats: 2,
      status: "confirmed",
      amountCents: 24000,
      source: "public_page",
    });
    expect(await sqlState(valid)).toBeUndefined();
  });

  it("refuse un second client avec le même e-mail, quelle que soit la casse", async () => {
    await createCustomer("camille.roux@mail.com");
    expect(await sqlState(createCustomer("Camille.Roux@MAIL.com"))).toBe(UNIQUE_VIOLATION);
  });
});
