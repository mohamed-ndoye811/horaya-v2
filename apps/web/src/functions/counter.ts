import { addDays, enrollmentQuote, formRules } from "@horaya/core";
import { getCustomerDetail, listCounterEvents } from "@horaya/db";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CounterEvent } from "@/features/counter/counter-wizard";
import { startOfDay, todayIn } from "@/lib/dates";
import { formatDayNumber, formatHour, formatMoney, formatWeekdayShort } from "@/lib/format";
import { searchText } from "@/lib/search-params";
import { counterSlots } from "@/server/counter-slots";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";

/** Durée lisible : « 2 h », « 1 h 30 », « 45 min ». */
function duration(startsAt: Date, endsAt: Date) {
  const minutes = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest
    ? `${Math.floor(minutes / 60)} h ${String(rest).padStart(2, "0")}`
    : `${minutes / 60} h`;
}

/** Séance et client déjà choisis (depuis une fiche événement ou client). */
export const counterSearch = z.object({
  evenement: searchText,
  client: z.uuid().optional().catch(undefined),
});

/** Comptoir : séances des 60 prochains jours, et le client passé dans l'adresse. */
export const getCounter = createServerFn({ method: "GET" })
  .validator(counterSearch)
  .handler(async ({ data }) => {
    const { workspace, timeZone } = await getWorkspaceContext();
    const now = new Date();
    const today = todayIn(timeZone, now);
    const tomorrow = startOfDay(addDays(today, 1), timeZone);
    const afterTomorrow = startOfDay(addDays(today, 2), timeZone);
    const [events, customer] = await Promise.all([
      listCounterEvents(db, workspace.id, { now, until: startOfDay(addDays(today, 60), timeZone) }),
      data.client ? getCustomerDetail(db, workspace.id, data.client, now) : null,
    ]);

    const clock = new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    });
    const weekday = new Intl.DateTimeFormat("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone,
    });
    const counterEvents: CounterEvent[] = events.map((event) => {
      // Inscription à toute la série : prix au prorata des séances restantes si la série le prévoit.
      const quote =
        event.enrollmentPriceCents === null
          ? null
          : enrollmentQuote({
              fullCents: event.enrollmentPriceCents,
              remaining: event.seriesRemaining,
              total: event.seriesTotal,
              prorata: event.enrollmentProrata,
            });
      return {
        id: event.id,
        title: event.title,
        day:
          event.startsAt < tomorrow
            ? "today"
            : event.startsAt < afterTomorrow
              ? "tomorrow"
              : "later",
        time: clock.format(event.startsAt),
        duration: duration(event.startsAt, event.endsAt),
        date: weekday.format(event.startsAt).replace(/^./, (first) => first.toUpperCase()),
        label: `${formatWeekdayShort(event.startsAt, timeZone)} ${formatDayNumber(event.startsAt, timeZone)} · ${formatHour(event.startsAt, timeZone)}`,
        range: `${clock.format(event.startsAt)} – ${clock.format(event.endsAt)}`,
        location: event.locationName,
        priceCents: event.priceCents,
        paymentMode: event.paymentMode,
        // Seulement ce que le comptoir utilise : tarifs et options, moyens acceptés.
        modules: {
          ...(event.modules.pricing && { pricing: event.modules.pricing }),
          ...(event.modules.payment_methods && { payment_methods: event.modules.payment_methods }),
        },
        color: event.color,
        remaining: event.capacity === null ? null : Math.max(0, event.capacity - event.seatsHeld),
        capacity: event.capacity,
        waitlist: event.waitlistEnabled,
        seriesId: event.seriesId,
        enrollmentPriceCents: quote?.priceCents ?? null,
        enrollmentNote: quote?.prorated
          ? `${quote.remaining} séance${quote.remaining > 1 ? "s" : ""} restante${quote.remaining > 1 ? "s" : ""} sur ${quote.total} : ${formatMoney(quote.priceCents)} au lieu de ${formatMoney(quote.fullCents)}`
          : null,
        fields: event.fields.filter((field) => field.scope !== "event"),
        // Questions en plus des règles, tranchées pour cette séance (lot 36).
        rules: formRules(event.rules, event.fields, {
          fieldValues: event.fieldValues,
          capacity: event.capacity,
          seatsHeld: event.seatsHeld,
        }),
      };
    });

    return {
      // Créneaux libres des types « sur rendez-vous » (lot 37), à la suite des séances.
      events: [...counterEvents, ...(await counterSlots(workspace.id, timeZone, now))],
      initialCustomer: customer
        ? {
            id: customer.customer.id,
            name: `${customer.customer.firstName} ${customer.customer.lastName}`,
            phone: customer.customer.phone,
            email: customer.customer.email,
            bookings: customer.customer.bookings,
          }
        : undefined,
    };
  });
