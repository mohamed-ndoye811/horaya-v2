import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type Actor,
  ConflictError,
  cancelEventBelowMinimum,
  createEvent,
  createEventBooking,
  createEventType,
  type Deps,
  type EventModules,
  ForbiddenError,
  type LegacyTypeSettings,
  legacyModules,
  publishEvent,
  updateEventType,
  ValidationError,
} from "@horaya/core";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  claimDueCustomReminders,
  claimFollowUps,
  claimMinimumDecisions,
  claimMinimumWarnings,
} from "../src/queries";
import { activityLog, booking, customer, event as eventTable } from "../src/schema";
import {
  contact,
  createMember,
  createOrganization,
  customerActor,
  db,
  fixedClock,
  testDeps,
} from "./helpers";

afterAll(() => db.$client.end());

describe("reprise des données (migration 0023)", () => {
  /** La requête de reprise de la migration, jouée sur une table qui a les anciennes colonnes. */
  const reprise = readFileSync(
    join(import.meta.dirname, "../migrations/0023_fonctionnement_modules.sql"),
    "utf8",
  )
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .find((statement) => statement.includes('UPDATE "event_type" SET "modules"'));

  it("donne les mêmes modules que legacyModules du core", async () => {
    expect(reprise).toBeDefined();
    const cases: LegacyTypeSettings[] = [
      { defaultCapacity: null, requiresApproval: false, bookingRules: {} },
      {
        defaultCapacity: 12,
        requiresApproval: true,
        bookingRules: { waitlistEnabled: true, minAdvanceHours: 24, maxSeatsPerBooking: 2 },
      },
      { defaultCapacity: null, requiresApproval: false, bookingRules: { maxSeatsPerBooking: 1 } },
      {
        defaultCapacity: 8,
        requiresApproval: false,
        bookingRules: { waitlistEnabled: false, minAdvanceHours: 0 },
      },
    ];
    const results = await db.transaction(async (tx) => {
      await tx.execute(sql`create temp table "legacy_type" (
        "id" int primary key, "default_capacity" int, "requires_approval" boolean not null,
        "booking_rules" jsonb not null, "modules" jsonb not null default '{}'::jsonb
      ) on commit drop`);
      for (const [index, legacy] of cases.entries()) {
        await tx.execute(
          sql`insert into "legacy_type" values (${index}, ${legacy.defaultCapacity}, ${legacy.requiresApproval}, ${JSON.stringify(legacy.bookingRules)}::jsonb)`,
        );
      }
      await tx.execute(sql.raw((reprise ?? "").replaceAll('"event_type"', '"legacy_type"')));
      return tx.execute<{ modules: EventModules }>(
        sql`select "modules" from "legacy_type" order by "id"`,
      );
    });
    expect(results.map((row) => row.modules)).toEqual(cases.map(legacyModules));
  });
});

describe("modules d'un type", () => {
  let organizationId: string;
  let owner: Actor;
  let clock: ReturnType<typeof fixedClock>;
  let deps: Deps;

  beforeEach(async () => {
    organizationId = await createOrganization("MOD");
    owner = await createMember(organizationId);
    clock = fixedClock();
    deps = testDeps(clock);
  });

  async function publishedEvent(modules: EventModules, startsAt: string, capacity = 10) {
    const type = await createEventType(deps, owner, {
      name: `Tournage ${Math.random().toString(36).slice(2, 7)}`,
      color: "#A9663F",
      modules,
    });
    const [created] = await createEvent(deps, owner, {
      eventTypeId: type.id,
      title: "Tournage",
      startsAt,
      endsAt: new Date(new Date(startsAt).getTime() + 2 * 3_600_000).toISOString(),
      timezone: "Europe/Paris",
      capacity,
    });
    if (!created) throw new Error("Événement non créé");
    return { type, event: await publishEvent(deps, owner, created.id) };
  }

  const book = (eventId: string, seats = 1, participants: unknown[] = []) =>
    createEventBooking(deps, customerActor(organizationId), {
      eventId,
      seats,
      customer: contact(`eleve-${Math.random().toString(36).slice(2, 8)}@mail.com`),
      participants: participants as never,
    });

  it("l'événement garde les modules du type ; « Appliquer aussi » les met à jour", async () => {
    const { type, event } = await publishedEvent({ waitlist: {} }, "2026-10-20T16:00:00Z");
    expect(event.modules).toEqual({ waitlist: {} });
    const [later] = await createEvent(deps, owner, {
      eventTypeId: type.id,
      title: "Tournage suivant",
      startsAt: "2026-10-27T16:00:00Z",
      endsAt: "2026-10-27T18:00:00Z",
      timezone: "Europe/Paris",
    });
    await book(event.id);
    await updateEventType(deps, owner, type.id, {
      modules: { approval: {} },
      applyToUpcoming: true,
    });
    const rows = await db
      .select({ id: eventTable.id, modules: eventTable.modules })
      .from(eventTable)
      .where(eq(eventTable.eventTypeId, type.id));
    const byId = new Map(rows.map((row) => [row.id, row.modules]));
    // Le premier a un inscrit : il garde sa version.
    expect(byId.get(event.id)).toEqual({ waitlist: {} });
    expect(byId.get(later?.id ?? "")).toEqual({ approval: {} });
  });

  it("validation manuelle et invitation : réglages par défaut des nouveaux événements", async () => {
    const { event } = await publishedEvent(
      { approval: {}, access: { inviteOnly: true } },
      "2026-10-20T16:00:00Z",
    );
    expect(event.requiresApproval).toBe(true);
    expect(event.visibility).toBe("invite_only");
  });

  it("ouverture des inscriptions : refusé avant J-N et après la fermeture", async () => {
    const { event } = await publishedEvent(
      { opening: { opensDaysBefore: 10, closesHoursBefore: 24 } },
      "2026-10-20T16:00:00Z",
    );
    await expect(book(event.id)).rejects.toThrow("pas encore ouvertes");
    clock.set(new Date("2026-10-15T08:00:00Z"));
    expect((await book(event.id)).booking.status).toBe("confirmed");
    clock.set(new Date("2026-10-19T17:00:00Z"));
    await expect(book(event.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("conditions d'accès : âge contrôlé par participant, étiquette demandée", async () => {
    const { type, event } = await publishedEvent(
      { access: { minAge: 12, tags: ["adhérent"] } },
      "2026-10-20T16:00:00Z",
    );
    // La question « Âge » a été ajoutée au type et copiée sur l'événement.
    expect(type.fields.map((field) => field.key)).toEqual(["age"]);
    const participant = (age: number) => ({
      firstName: "Léa",
      lastName: "Roux",
      email: null,
      answers: { age },
    });
    const email = "adherente@mail.com";
    const attempt = (age: number) =>
      createEventBooking(deps, customerActor(organizationId), {
        eventId: event.id,
        seats: 1,
        customer: contact(email),
        participants: [participant(age)],
      });
    await expect(attempt(9)).rejects.toBeInstanceOf(ValidationError);
    await expect(attempt(14)).rejects.toBeInstanceOf(ForbiddenError);
    // Le refus n'a laissé aucune fiche client.
    expect(await db.select().from(customer).where(eq(customer.email, email))).toEqual([]);
    await db.insert(customer).values({
      organizationId,
      firstName: "Camille",
      lastName: "Roux",
      email,
      tags: ["Adhérent"],
    });
    expect((await attempt(14)).booking.status).toBe("confirmed");
  });

  it("seuil de maintien : prévient la veille de J-x, annule à J-x, garde un événement assez rempli", async () => {
    const places = { capacity: 10, minimum: { seats: 3, daysBefore: 2 } };
    // Dates lointaines et propres à ce test : les tâches portent sur tous les espaces.
    const empty = await publishedEvent({ places }, "2032-05-10T16:00:00Z");
    const full = await publishedEvent({ places }, "2032-05-10T16:00:00Z");
    await book(empty.event.id);
    await book(full.event.id, 3);

    // La veille de J-2 : seul l'événement sous le seuil est signalé, une seule fois.
    const eve = new Date("2032-05-07T17:00:00Z");
    const warned = await claimMinimumWarnings(db, eve);
    expect(warned.filter((row) => row.organizationId === organizationId)).toMatchObject([
      { id: empty.event.id, seats: 1, minimum: 3 },
    ]);
    expect(
      (await claimMinimumWarnings(db, eve)).filter((row) => row.organizationId === organizationId),
    ).toEqual([]);

    // J-2 : une décision par événement ; le core n'annule que celui sous le seuil.
    const decision = new Date("2032-05-08T16:00:00Z");
    clock.set(decision);
    const decided = (await claimMinimumDecisions(db, decision)).filter(
      (row) => row.organizationId === organizationId,
    );
    expect(decided.map((row) => row.id).sort()).toEqual([empty.event.id, full.event.id].sort());
    const outcomes = await Promise.all(
      decided.map((row) => cancelEventBelowMinimum(deps, organizationId, row.id)),
    );
    expect(outcomes.filter(Boolean)).toMatchObject([{ cancelledBookings: 1, seats: 1 }]);
    expect(await claimMinimumDecisions(db, decision)).not.toContainEqual(
      expect.objectContaining({ organizationId }),
    );

    const [cancelled] = await db.select().from(eventTable).where(eq(eventTable.id, empty.event.id));
    expect(cancelled?.status).toBe("cancelled");
    const [kept] = await db.select().from(eventTable).where(eq(eventTable.id, full.event.id));
    expect(kept?.status).toBe("published");
    const [cancelledBooking] = await db
      .select()
      .from(booking)
      .where(eq(booking.eventId, empty.event.id));
    expect(cancelledBooking?.status).toBe("cancelled");
    // Parcours d'annulation habituel : l'e-mail part du journal, avec le motif.
    const logs = await db
      .select({
        action: activityLog.action,
        data: activityLog.data,
        actorType: activityLog.actorType,
      })
      .from(activityLog)
      .where(eq(activityLog.entityId, cancelledBooking?.id ?? ""));
    expect(logs).toContainEqual({
      action: "booking.cancelled",
      data: { reason: "minimum_not_reached" },
      actorType: "system",
    });
  });

  it("rappel au moment choisi et message après la séance, une seule fois", async () => {
    const { event } = await publishedEvent(
      { messages: { reminder: { kind: "eve", hour: 18 }, after: "Merci !" } },
      "2032-06-10T14:00:00Z",
    );
    const { booking: booked } = await book(event.id);
    // La veille à 18 h, heure de Paris (16 h UTC en juin).
    expect(
      (await claimDueCustomReminders(db, new Date("2032-06-09T15:59:00Z"))).map((row) => row.id),
    ).not.toContain(booked.id);
    expect(
      (await claimDueCustomReminders(db, new Date("2032-06-09T16:00:00Z"))).map((row) => row.id),
    ).toContain(booked.id);
    expect(
      (await claimDueCustomReminders(db, new Date("2032-06-09T17:00:00Z"))).map((row) => row.id),
    ).not.toContain(booked.id);

    const after = new Date("2032-06-10T17:00:00Z");
    expect((await claimFollowUps(db, after)).map((row) => row.id)).toContain(event.id);
    expect((await claimFollowUps(db, after)).map((row) => row.id)).not.toContain(event.id);
  });
});
