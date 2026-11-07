import { getCalendarFeed, regenerateCalendarFeed } from "@horaya/core";
import { findCalendarFeedByToken, listCalendarFeedEvents } from "@horaya/db";
import { calendarFeedIcs, FEED_DAYS_AFTER, FEED_DAYS_BEFORE } from "@/lib/calendar-feed";
import { db } from "./db";
import type { FormState } from "./form-state";
import { absoluteUrl } from "./mailer";
import { deps, type MemberActor, requireMember } from "./services";

const DAY = 86_400_000;

/** Flux ICS d'un membre (route /agenda/<jeton>.ics) : 404 si le jeton ou le membre n'existe plus. */
export async function calendarFeedResponse(token: string): Promise<Response> {
  const feed = await findCalendarFeedByToken(db, token);
  if (!feed) return new Response("Agenda introuvable", { status: 404 });
  const now = new Date();
  const events = await listCalendarFeedEvents(db, feed.organizationId, {
    from: new Date(now.getTime() - FEED_DAYS_BEFORE * DAY),
    to: new Date(now.getTime() + FEED_DAYS_AFTER * DAY),
  });
  const ics = calendarFeedIcs({
    workspaceName: feed.organizationName,
    events,
    eventUrl: (eventId) => absoluteUrl(`/app/evenements/${eventId}`),
    now,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="agenda.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
}

const feedUrl = (token: string) => absoluteUrl(`/agenda/${token}.ics`);

/** Adresse d'abonnement du membre connecté (créée à la première visite de son profil). */
export async function myCalendarFeedUrl(actor: MemberActor): Promise<string> {
  return feedUrl((await getCalendarFeed(deps, actor)).token);
}

export async function regenerateMyCalendarFeed(): Promise<FormState> {
  await regenerateCalendarFeed(deps, await requireMember());
  return { success: "Nouvelle adresse créée : l'ancienne ne marche plus." };
}
