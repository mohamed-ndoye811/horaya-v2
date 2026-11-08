import { cancelEventBelowMinimum, runScheduledRule } from "@horaya/core";
import {
  claimBookingReminders,
  claimDueCustomReminders,
  claimEventReminders,
  claimFollowUps,
  claimMinimumDecisions,
  claimMinimumWarnings,
  claimWeeklyDigests,
  countConfirmedSeats,
  listConfirmedBookingIds,
  listDueRules,
} from "@horaya/db";
import {
  notifyMinimum,
  sendBookingReminder,
  sendFollowUp,
  sendTeamReminder,
  sendWeeklyDigest,
} from "./booking-emails";
import { db } from "./db";
import { deps } from "./services";

const HOUR = 3_600_000;

/**
 * Rappels de la veille : événements qui commencent dans 12 à 24 h. Le client confirmé reçoit
 * un e-mail (sauf s'il a réservé il y a moins de 6 h), l'équipe un rappel selon ses
 * préférences. Chaque rappel part une seule fois (voir queries/reminders.ts).
 */
export async function sendDueReminders(now = new Date()): Promise<number> {
  const events = await claimEventReminders(
    db,
    new Date(now.getTime() + 12 * HOUR),
    new Date(now.getTime() + 24 * HOUR),
  );
  for (const event of events) {
    // Rappel client à un autre moment (module Messages) : envoyé par sendModuleTasks.
    const bookings = event.customReminder
      ? []
      : await claimBookingReminders(db, event.id, new Date(now.getTime() - 6 * HOUR));
    for (const booking of bookings) await sendBookingReminder(event.organizationId, booking.id);
    await sendTeamReminder({
      ...event,
      eventId: event.id,
      seats: await countConfirmedSeats(db, event.id),
    });
  }
  return events.length;
}

/**
 * Tâches des modules (lot 34), à chaque passage :
 * - seuil de maintien : l'équipe prévenue la veille de J-x, puis décision à J-x (annulation
 *   par le core, avec le parcours habituel : e-mails aux inscrits, cartes recréditées) ;
 * - rappel au moment choisi et message après la séance (module Messages) ;
 * - règles « si… alors… » planifiées (X avant la séance, après la séance, lot 36) : chacune
 *   prend sa trace sous le verrou de l'événement, ses envois partent après la transaction.
 * Chaque envoi est réservé avant de partir (voir queries/reminders.ts).
 */
export async function sendModuleTasks(now = new Date()) {
  for (const event of await claimMinimumWarnings(db, now)) await notifyMinimum("risk", event);
  for (const event of await claimMinimumDecisions(db, now)) {
    const cancelled = await cancelEventBelowMinimum(deps, event.organizationId, event.id);
    if (cancelled) {
      await notifyMinimum("cancelled", {
        ...event,
        seats: cancelled.seats,
        cancelledBookings: cancelled.cancelledBookings,
      });
    }
  }
  for (const booking of await claimDueCustomReminders(db, now)) {
    await sendBookingReminder(booking.organizationId, booking.id, true);
  }
  for (const event of await claimFollowUps(db, now)) {
    for (const id of await listConfirmedBookingIds(db, event.id)) {
      await sendFollowUp(event.organizationId, id);
    }
  }
  for (const due of await listDueRules(db, now)) {
    await runScheduledRule(deps, due.organizationId, due.eventId, due.ruleId).catch((error) =>
      console.error("Règle planifiée", due, error),
    );
  }
}

/** Récap hebdomadaire : chaque espace le reçoit le lundi, au premier passage après 8 h. */
export async function sendDueWeeklyDigests(now = new Date()): Promise<number> {
  const workspaces = await claimWeeklyDigests(db, now);
  for (const { organizationId } of workspaces) await sendWeeklyDigest(organizationId, now);
  return workspaces.length;
}

/**
 * Passage toutes les heures dans le serveur de production (une minute après le démarrage).
 * Plusieurs instances ne posent pas de problème : chaque rappel est réservé avant l'envoi.
 */
export function scheduleReminders() {
  const run = () => {
    sendDueReminders().catch((error) => console.error("Rappels de la veille", error));
    sendModuleTasks().catch((error) => console.error("Tâches des modules", error));
    sendDueWeeklyDigests().catch((error) => console.error("Récap hebdomadaire", error));
  };
  setTimeout(run, 60_000).unref();
  setInterval(run, HOUR).unref();
}
