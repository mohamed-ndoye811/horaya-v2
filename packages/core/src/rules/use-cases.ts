import type { Booking } from "../bookings/model";
import type { Event } from "../events/model";
import { cancelLockedEvent } from "../events/use-cases";
import type { FieldValues, RawFieldValues } from "../fields/model";
import { parseFieldValues } from "../fields/values";
import { type Actor, actorRef } from "../shared/actor";
import { NotFoundError } from "../shared/errors";
import type { Deps, Repositories } from "../shared/unit-of-work";
import {
  isRuleDue,
  type RuleFacts,
  ruleMatches,
  rulesFor,
  type SubmissionOutcome,
  submissionOutcome,
} from "./engine";
import type { Rule, RuleAction, RuleTriggerKind } from "./model";

/** Faits d'un événement (sous son verrou) : description, places prises, matériel restant. */
export async function eventFacts(
  repositories: Repositories,
  event: Event,
): Promise<NonNullable<RuleFacts["event"]>> {
  return {
    fieldValues: event.fieldValues,
    capacity: event.capacity,
    seatsHeld: await repositories.bookings.seatsHeld(event.id),
    equipmentLeft: await repositories.rules.equipmentLeft(event.id),
  };
}

/**
 * Trace et journal des règles appliquées : une ligne `rule_run` (jamais deux fois la même
 * règle sur la même séance ou inscription) et une entrée `booking.rule_applied` ou
 * `event.rule_applied`, d'où partent après validation les e-mails et notifications.
 * `notify: false` : rien n'est envoyé (séances 2 et suivantes d'une inscription à la série).
 */
export async function recordRuleRuns(
  repositories: Repositories,
  actor: Actor,
  input: {
    event: Event;
    bookingId: string | null;
    trigger: RuleTriggerKind;
    runs: Array<{ rule: Rule; actions: RuleAction[] }>;
    notify?: boolean;
  },
): Promise<void> {
  for (const { rule, actions } of input.runs) {
    if (actions.length === 0) continue;
    const claimed = await repositories.rules.claim({
      organizationId: input.event.organizationId,
      eventId: input.event.id,
      bookingId: input.bookingId,
      ruleId: rule.id,
      ruleName: rule.name,
      trigger: input.trigger,
      matched: true,
      actions,
    });
    if (!claimed) continue;
    await repositories.activity.record({
      organizationId: input.event.organizationId,
      entityType: input.bookingId ? "booking" : "event",
      entityId: input.bookingId ?? input.event.id,
      action: input.bookingId ? "booking.rule_applied" : "event.rule_applied",
      ...actorRef(actor),
      data: {
        ruleId: rule.id,
        rule: rule.name,
        trigger: input.trigger,
        actions,
        ...(input.notify === false && { notify: false }),
      },
    });
  }
}

/**
 * Règles « Une inscription est envoyée », avant l'écriture de l'inscription : questions en
 * plus (réponses validées comme les autres), refus, mise en validation. Les réponses données
 * aux questions des règles qui ne s'appliquent pas sont jetées.
 */
export async function checkSubmissionRules(
  repositories: Repositories,
  event: Event,
  input: {
    customerId: string;
    answers: FieldValues;
    participants: ReadonlyArray<{ answers: FieldValues }>;
    rawAnswers: RawFieldValues;
    now: Date;
    enrollmentId?: string;
    enforceRequired: boolean;
  },
): Promise<{
  outcome: SubmissionOutcome;
  answers: FieldValues;
  issues: Array<{ path: string; message: string }>;
}> {
  const empty = { matched: [], asked: [], refusal: null, approval: false };
  if (rulesFor(event.rules, "booking_submitted").length === 0) {
    return { outcome: empty, answers: {}, issues: [] };
  }
  const facts: RuleFacts = {
    event: await eventFacts(repositories, event),
    booking: { answers: input.answers, participants: input.participants },
    customer: await repositories.rules.customerFacts(event.organizationId, input.customerId, {
      now: input.now,
      exceptEnrollmentId: input.enrollmentId,
    }),
  };
  const outcome = submissionOutcome(event.rules, event.fields, facts);
  const { values, errors } = parseFieldValues(outcome.asked, input.rawAnswers, {
    now: input.now,
    enforceRequired: input.enforceRequired,
  });
  return {
    outcome,
    answers: values,
    issues: Object.entries(errors).map(([key, message]) => ({ path: `answers.${key}`, message })),
  };
}

/** Faits d'une inscription existante : son événement, ses réponses, son client. */
async function bookingFacts(
  repositories: Repositories,
  event: Event,
  booking: Booking,
  now: Date,
): Promise<RuleFacts> {
  return {
    event: await eventFacts(repositories, event),
    booking: {
      answers: booking.answers,
      participants: (await repositories.rules.participantAnswers(booking.id)).map((answers) => ({
        answers,
      })),
    },
    customer: await repositories.rules.customerFacts(event.organizationId, booking.customerId, {
      now,
      exceptBookingId: booking.id,
    }),
  };
}

/** « Une place se libère », « Une inscription est annulée » : sous le verrou de l'événement. */
export async function runBookingRules(
  repositories: Repositories,
  actor: Actor,
  trigger: "seat_released" | "booking_cancelled",
  event: Event,
  booking: Booking,
  now: Date,
): Promise<void> {
  const rules = rulesFor(event.rules, trigger);
  if (rules.length === 0) return;
  const facts = await bookingFacts(repositories, event, booking, now);
  await recordRuleRuns(repositories, actor, {
    event,
    bookingId: booking.id,
    trigger,
    runs: rules
      .filter((rule) => ruleMatches(rule, event.fields, facts))
      .map((rule) => ({ rule, actions: rule.actions })),
  });
}

/**
 * Règle planifiée (X avant la séance, après la séance), appelée par la tâche de chaque heure.
 * Sous le verrou de l'événement : la règle est revérifiée (publiée, dans sa fenêtre), évaluée
 * une seule fois (la trace est prise même si les conditions ne sont pas remplies), puis ses
 * actions appliquées. « Annuler la séance » passe par le parcours d'annulation habituel.
 */
export async function runScheduledRule(
  deps: Deps,
  organizationId: string,
  eventId: string,
  ruleId: string,
): Promise<{ matched: boolean; actions: RuleAction[] } | null> {
  const actor: Actor = { type: "system", organizationId };
  return deps.uow.run(async (repositories) => {
    const locked = await repositories.events.lockForBooking(organizationId, eventId);
    if (locked?.event.status !== "published") return null;
    const { event } = locked;
    const now = deps.clock.now();
    const rule = event.rules.find((entry) => entry.id === ruleId);
    if (!rule || !isRuleDue(rule.trigger, event, now)) return null;
    const matched = ruleMatches(rule, event.fields, {
      event: await eventFacts(repositories, event),
    });
    const claimed = await repositories.rules.claim({
      organizationId,
      eventId,
      bookingId: null,
      ruleId,
      ruleName: rule.name,
      trigger: rule.trigger.kind,
      matched,
      actions: matched ? rule.actions : [],
    });
    if (!claimed) return null;
    if (!matched) return { matched, actions: [] };
    await repositories.activity.record({
      organizationId,
      entityType: "event",
      entityId: eventId,
      action: "event.rule_applied",
      ...actorRef(actor),
      data: { ruleId, rule: rule.name, trigger: rule.trigger.kind, actions: rule.actions },
    });
    if (rule.actions.some((action) => action.kind === "cancel_event")) {
      await cancelLockedEvent(repositories, actor, event, now, `Règle « ${rule.name} »`);
    }
    return { matched, actions: rule.actions };
  });
}

/**
 * « Tester sur une inscription » : les faits d'une inscription existante, pour que l'éditeur
 * montre ce qu'une règle (même pas enregistrée) ferait. Lecture seule, rien n'est exécuté.
 */
export async function ruleTestFacts(
  deps: Deps,
  actor: Actor,
  bookingId: string,
): Promise<RuleFacts> {
  if (actor.type !== "member") throw new NotFoundError("Réservation", bookingId);
  return deps.uow.run(async (repositories) => {
    const booking = await repositories.bookings.find(actor.organizationId, bookingId);
    const event = booking?.eventId
      ? await repositories.events.find(actor.organizationId, booking.eventId)
      : null;
    if (!booking || !event) throw new NotFoundError("Réservation", bookingId);
    const facts = await bookingFacts(repositories, event, booking, deps.clock.now());
    // Les places prises comptent sans elle, comme au moment où elle a été envoyée.
    if (facts.event && ["pending", "confirmed"].includes(booking.status)) {
      facts.event.seatsHeld = Math.max(0, facts.event.seatsHeld - booking.seats);
    }
    return facts;
  });
}
