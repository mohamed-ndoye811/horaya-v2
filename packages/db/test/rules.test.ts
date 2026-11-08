import {
  type Actor,
  ConflictError,
  cancelBooking,
  createEvent,
  createEventBooking,
  createEventType,
  type Deps,
  type EventTypeField,
  publishEvent,
  type Rule,
  refuseBooking,
  runScheduledRule,
  updateEventType,
  ValidationError,
} from "@horaya/core";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { listDueRules, listEventRuleRuns } from "../src/queries";
import { activityLog, booking, event as eventTable, ruleRun } from "../src/schema";
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

const FIELDS: EventTypeField[] = [
  {
    key: "niveau",
    label: "Niveau",
    type: "choice",
    scope: "event",
    required: true,
    options: ["Débutant", "Confirmé"],
  },
  { key: "age", label: "Âge", type: "number", scope: "participant", required: true },
];

const MINORS: Rule = {
  id: "mineurs",
  name: "Autorisation des mineurs",
  trigger: { kind: "booking_submitted" },
  conditions: [[{ kind: "field", fieldKey: "age", operator: "less_than", value: 16 }]],
  actions: [
    {
      kind: "ask",
      field: { key: "accord_parent", label: "J'autorise sa participation", type: "acceptance" },
    },
    { kind: "remind_document", label: "l'autorisation signée" },
  ],
};

const LAST_SEATS: Rule = {
  id: "dernieres-places",
  name: "Dernières places",
  trigger: { kind: "before_start", hours: 7 * 24 },
  conditions: [
    [
      { kind: "field", fieldKey: "niveau", operator: "equals", value: "Débutant" },
      { kind: "seats", measure: "remaining", operator: "greater_than", value: 0 },
    ],
  ],
  actions: [{ kind: "notify_team", message: "Relance les anciens élèves" }],
};

describe("règles « si… alors… »", () => {
  let organizationId: string;
  let owner: Actor;
  let clock: ReturnType<typeof fixedClock>;
  let deps: Deps;

  beforeEach(async () => {
    organizationId = await createOrganization("REG");
    owner = await createMember(organizationId);
    clock = fixedClock();
    deps = testDeps(clock);
  });

  async function publishedEvent(rules: Rule[], niveau = "Débutant", capacity = 10) {
    const type = await createEventType(deps, owner, {
      name: `Tournage ${Math.random().toString(36).slice(2, 7)}`,
      color: "#A9663F",
      fields: FIELDS,
      rules,
    });
    const [created] = await createEvent(deps, owner, {
      eventTypeId: type.id,
      title: "Tournage",
      startsAt: "2026-10-20T16:00:00Z",
      endsAt: "2026-10-20T18:00:00Z",
      timezone: "Europe/Paris",
      capacity,
      fieldValues: { niveau },
    });
    if (!created) throw new Error("Événement non créé");
    return { type, event: await publishEvent(deps, owner, created.id) };
  }

  const book = (
    eventId: string,
    ages: number[],
    answers: Record<string, string | boolean> = {},
    actor: Actor = customerActor(organizationId),
  ) =>
    createEventBooking(deps, actor, {
      eventId,
      seats: ages.length,
      customer: contact(`eleve-${Math.random().toString(36).slice(2, 8)}@mail.com`),
      answers,
      participants: ages.map((age, index) => ({
        firstName: `P${index}`,
        lastName: "Roux",
        answers: { age: String(age) },
      })),
    });

  const runsOf = (eventId: string) => db.select().from(ruleRun).where(eq(ruleRun.eventId, eventId));

  it("l'événement garde les règles du type", async () => {
    const { event } = await publishedEvent([MINORS]);
    expect(event.rules).toEqual([MINORS]);
  });

  it("refuse une règle qui vise un champ inconnu", async () => {
    const { type } = await publishedEvent([]);
    await expect(
      updateEventType(deps, owner, type.id, {
        rules: [
          { ...MINORS, conditions: [[{ kind: "field", fieldKey: "taille", operator: "filled" }]] },
        ],
      }),
    ).rejects.toThrow(ValidationError);
  });

  describe("inscription envoyée", () => {
    it("tarifs : l'option prise déclenche une réduction, calculée et tracée par le serveur", async () => {
      const type = await createEventType(deps, owner, {
        name: "Tournage payant",
        color: "#A9663F",
        fields: FIELDS,
        modules: {
          pricing: {
            rates: [
              { id: "plein", name: "Plein", priceCents: 4000 },
              { id: "reduit", name: "Réduit", priceCents: 3000 },
            ],
            options: [{ id: "cuisson", name: "Cuisson", priceCents: 800, per: "participant" }],
          },
        },
        rules: [
          {
            id: "pack",
            name: "Pack cuisson",
            trigger: { kind: "booking_submitted" },
            conditions: [[{ kind: "pricing", target: "option", id: "cuisson" }]],
            actions: [{ kind: "price", apply: "percent", percent: 10 }],
          },
        ],
      });
      const [created] = await createEvent(deps, owner, {
        eventTypeId: type.id,
        title: "Tournage",
        startsAt: "2026-10-20T16:00:00Z",
        endsAt: "2026-10-20T18:00:00Z",
        timezone: "Europe/Paris",
        capacity: 10,
        priceCents: 4000,
        paymentMode: "on_site",
        fieldValues: { niveau: "Débutant" },
      });
      if (!created) throw new Error("Événement non créé");
      await publishEvent(deps, owner, created.id);
      const order = (options: Record<string, number>) =>
        createEventBooking(deps, customerActor(organizationId), {
          eventId: created.id,
          seats: 1,
          customer: contact(`eleve-${Math.random().toString(36).slice(2, 8)}@mail.com`),
          participants: [{ firstName: "P", lastName: "Roux", answers: { age: "30" } }],
          options,
        });
      expect((await order({})).booking.amountCents).toBe(4000);
      const { booking } = await order({ cuisson: 1 });
      // (40 € + 8 €) − 10 % = 43,20 €.
      expect(booking.amountCents).toBe(4320);
      expect(booking.priceLines.at(-1)).toMatchObject({
        kind: "discount",
        id: "pack",
        totalCents: -480,
      });
      expect(await runsOf(created.id)).toMatchObject([{ bookingId: booking.id, ruleId: "pack" }]);
      // Une règle qui vise un tarif absent du type est refusée.
      await expect(
        updateEventType(deps, owner, type.id, {
          rules: [
            {
              id: "vip",
              name: "VIP",
              trigger: { kind: "booking_submitted" },
              conditions: [],
              actions: [{ kind: "price", apply: "rate", rateId: "vip" }],
            },
          ],
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("un mineur : l'acceptation est exigée, puis enregistrée, tracée et journalisée", async () => {
      const { event } = await publishedEvent([MINORS]);
      const error = await book(event.id, [34, 14]).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).issues).toEqual([
        { path: "answers.accord_parent", message: "Coche la case pour continuer" },
      ]);

      const { booking: created } = await book(event.id, [34, 14], { accord_parent: true });
      expect(created.status).toBe("confirmed");
      expect(created.answers.accord_parent).toEqual(clock.now().toISOString());
      const runs = await runsOf(event.id);
      expect(runs).toMatchObject([
        { bookingId: created.id, ruleId: "mineurs", matched: true, trigger: "booking_submitted" },
      ]);
      const [entry] = await db
        .select()
        .from(activityLog)
        .where(
          and(eq(activityLog.entityId, created.id), eq(activityLog.action, "booking.rule_applied")),
        );
      expect(entry?.data).toMatchObject({
        rule: "Autorisation des mineurs",
        actions: MINORS.actions,
      });
      expect(await listEventRuleRuns(db, organizationId, event.id)).toMatchObject([
        {
          ruleName: "Autorisation des mineurs",
          bookingId: created.id,
          customerName: "Camille Roux",
        },
      ]);
    });

    it("des adultes : rien n'est demandé, la réponse en trop est jetée", async () => {
      const { event } = await publishedEvent([MINORS]);
      const { booking: created } = await book(event.id, [34], { accord_parent: true });
      expect(created.answers).toEqual({});
      expect(await runsOf(event.id)).toEqual([]);
    });

    it("refuser : le client est refusé avec le message, l'équipe garde la main", async () => {
      const refuse: Rule = {
        ...MINORS,
        id: "pas-de-mineurs",
        actions: [{ kind: "refuse", message: "Ce cours est réservé aux plus de 16 ans" }],
      };
      const { event } = await publishedEvent([refuse]);
      await expect(book(event.id, [14])).rejects.toThrow(
        new ConflictError("Ce cours est réservé aux plus de 16 ans"),
      );
      const { booking: created } = await book(event.id, [14], {}, owner);
      expect(created.status).toBe("confirmed");
      // Le refus n'a pas agi : rien au journal des règles.
      expect(await runsOf(event.id)).toEqual([]);
    });

    it("mettre en validation : l'inscription attend l'accord de l'équipe", async () => {
      const approval: Rule = {
        id: "nouveaux",
        name: "Nouveaux à valider",
        trigger: { kind: "booking_submitted" },
        conditions: [[{ kind: "customer", is: "new" }]],
        actions: [{ kind: "require_approval" }, { kind: "notify_team" }],
      };
      const { event } = await publishedEvent([approval]);
      const { booking: created } = await book(event.id, [30]);
      expect(created.status).toBe("pending");
      expect((await runsOf(event.id))[0]?.actions).toEqual(approval.actions);
    });
  });

  describe("annulation et place libérée", () => {
    it("chaque déclencheur tourne une fois pour l'inscription", async () => {
      const rules: Rule[] = [
        {
          id: "annulee",
          name: "Annulée",
          trigger: { kind: "booking_cancelled" },
          conditions: [],
          actions: [{ kind: "notify_team" }],
        },
        {
          id: "liberee",
          name: "Place libérée",
          trigger: { kind: "seat_released" },
          conditions: [
            [{ kind: "seats", measure: "remaining", operator: "greater_than", value: 0 }],
          ],
          actions: [{ kind: "notify_team" }],
        },
      ];
      const { event } = await publishedEvent(rules);
      const { booking: first } = await book(event.id, [30]);
      await cancelBooking(deps, owner, first.id, "Empêchée");
      const runs = await runsOf(event.id);
      expect(runs.map((run) => run.ruleId).sort()).toEqual(["annulee", "liberee"]);
      expect(runs.every((run) => run.bookingId === first.id)).toBe(true);
    });

    it("un refus libère une place mais n'est pas une annulation", async () => {
      const rules: Rule[] = [
        {
          id: "annulee",
          name: "Annulée",
          trigger: { kind: "booking_cancelled" },
          conditions: [],
          actions: [{ kind: "notify_team" }],
        },
        {
          id: "liberee",
          name: "Place libérée",
          trigger: { kind: "seat_released" },
          conditions: [],
          actions: [{ kind: "notify_team" }],
        },
      ];
      const { type, event } = await publishedEvent(rules);
      await db
        .update(eventTable)
        .set({ requiresApproval: true })
        .where(eq(eventTable.id, event.id));
      const { booking: pending } = await book(event.id, [30]);
      expect(pending.status).toBe("pending");
      await refuseBooking(deps, owner, pending.id, "Complet");
      expect((await runsOf(event.id)).map((run) => run.ruleId)).toEqual(["liberee"]);
      expect(type.rules).toHaveLength(2);
    });
  });

  describe("moments planifiés", () => {
    it("J-7 : exécutée une seule fois dans sa fenêtre, avec sa trace", async () => {
      const { event } = await publishedEvent([LAST_SEATS]);
      await book(event.id, [30]);
      clock.set(new Date("2026-10-13T15:00:00Z"));
      expect(await listDueRules(db, clock.now())).toEqual([]);
      expect(await runScheduledRule(deps, organizationId, event.id, LAST_SEATS.id)).toBeNull();

      clock.set(new Date("2026-10-13T17:00:00Z"));
      expect(await listDueRules(db, clock.now())).toContainEqual({
        organizationId,
        eventId: event.id,
        ruleId: LAST_SEATS.id,
      });
      const [first, second] = await Promise.all([
        runScheduledRule(deps, organizationId, event.id, LAST_SEATS.id),
        runScheduledRule(deps, organizationId, event.id, LAST_SEATS.id),
      ]);
      expect([first, second].filter(Boolean)).toEqual([
        { matched: true, actions: LAST_SEATS.actions },
      ]);
      expect(await runScheduledRule(deps, organizationId, event.id, LAST_SEATS.id)).toBeNull();
      expect(
        (await listDueRules(db, clock.now())).filter((due) => due.eventId === event.id),
      ).toEqual([]);
      const journal = await db
        .select()
        .from(activityLog)
        .where(
          and(eq(activityLog.entityId, event.id), eq(activityLog.action, "event.rule_applied")),
        );
      expect(journal).toHaveLength(1);
      expect(journal[0]?.data).toMatchObject({ rule: "Dernières places" });
    });

    it("conditions non remplies : la trace est prise, rien ne se passe ni ne recommence", async () => {
      const { event } = await publishedEvent([LAST_SEATS], "Confirmé");
      clock.set(new Date("2026-10-14T08:00:00Z"));
      expect(await runScheduledRule(deps, organizationId, event.id, LAST_SEATS.id)).toEqual({
        matched: false,
        actions: [],
      });
      expect(await runsOf(event.id)).toMatchObject([{ matched: false, actions: [] }]);
      expect(await listEventRuleRuns(db, organizationId, event.id)).toEqual([]);
      expect(
        (await listDueRules(db, clock.now())).filter((due) => due.eventId === event.id),
      ).toEqual([]);
    });

    it("annuler la séance passe par le parcours d'annulation", async () => {
      const cancel: Rule = {
        id: "trop-peu",
        name: "Trop peu d'inscrits",
        trigger: { kind: "before_start", hours: 48 },
        conditions: [[{ kind: "seats", measure: "booked", operator: "less_than", value: 4 }]],
        actions: [{ kind: "cancel_event" }, { kind: "message", subject: "Annulé", body: "Désolé" }],
      };
      const { event } = await publishedEvent([cancel]);
      const { booking: created } = await book(event.id, [30]);
      clock.set(new Date("2026-10-18T17:00:00Z"));
      await runScheduledRule(deps, organizationId, event.id, cancel.id);
      const [row] = await db.select().from(eventTable).where(eq(eventTable.id, event.id));
      expect(row?.status).toBe("cancelled");
      const [cancelled] = await db.select().from(booking).where(eq(booking.id, created.id));
      expect(cancelled?.status).toBe("cancelled");
    });

    it("après la séance : pendant deux jours", async () => {
      const after: Rule = {
        id: "merci",
        name: "Merci",
        trigger: { kind: "after_end" },
        conditions: [],
        actions: [{ kind: "message", subject: "Merci", body: "À bientôt" }],
      };
      const { event } = await publishedEvent([after]);
      clock.set(new Date("2026-10-23T08:00:00Z"));
      expect(
        (await listDueRules(db, clock.now())).filter((due) => due.eventId === event.id),
      ).toEqual([]);
      clock.set(new Date("2026-10-21T08:00:00Z"));
      expect(await runScheduledRule(deps, organizationId, event.id, after.id)).toEqual({
        matched: true,
        actions: after.actions,
      });
    });
  });
});
