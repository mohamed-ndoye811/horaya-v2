import {
  claimBookingReminders,
  claimEventReminders,
  claimWeeklyDigests,
  countConfirmedSeats,
} from "@horaya/db";
import { sendBookingReminder, sendTeamReminder, sendWeeklyDigest } from "./booking-emails";
import { db } from "./db";

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
    const bookings = await claimBookingReminders(db, event.id, new Date(now.getTime() - 6 * HOUR));
    for (const booking of bookings) await sendBookingReminder(event.organizationId, booking.id);
    await sendTeamReminder({
      ...event,
      eventId: event.id,
      seats: await countConfirmedSeats(db, event.id),
    });
  }
  return events.length;
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
    sendDueWeeklyDigests().catch((error) => console.error("Récap hebdomadaire", error));
  };
  setTimeout(run, 60_000).unref();
  setInterval(run, HOUR).unref();
}
