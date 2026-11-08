/** Comptoir (lot 37) : les créneaux libres des types « sur rendez-vous », comme des séances. */
import { addDays, durationLabel, findSlots, formRules, withChosenDuration } from "@horaya/core";
import type { CounterEvent } from "@/features/counter/counter-wizard";
import { startOfDay, todayIn } from "@/lib/dates";
import { formatDayNumber, formatHour, formatWeekdayShort } from "@/lib/format";
import { deps } from "./services";

/** Créneaux de la semaine qui vient, une entrée par durée proposée. */
export async function counterSlots(
  organizationId: string,
  timeZone: string,
  now: Date,
): Promise<CounterEvent[]> {
  const today = todayIn(timeZone, now);
  const tomorrow = startOfDay(addDays(today, 1), timeZone);
  const afterTomorrow = startOfDay(addDays(today, 2), timeZone);
  const clock = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone });
  const weekday = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  });
  return deps.uow.run(async (repositories) => {
    const settings = await repositories.settings.get(organizationId);
    const entries: CounterEvent[] = [];
    for (const type of await repositories.eventTypes.listWithSlots(organizationId)) {
      const durations = type.modules.duration?.options ?? [null];
      for (const option of durations) {
        const slots = await findSlots(repositories, organizationId, type, {
          from: today,
          days: 7,
          now,
          timeZone,
          durationId: option?.id ?? null,
          team: true,
        });
        const modules = option ? withChosenDuration(type.modules, option) : type.modules;
        const priceCents = option?.priceCents ?? type.defaultPriceCents ?? 0;
        for (const slot of slots) {
          const seatsLeft = Math.max(...slot.options.map((entry) => entry.seatsLeft));
          entries.push({
            id: `slot:${type.id}:${option?.id ?? ""}:${slot.startsAt.toISOString()}`,
            slot: {
              eventTypeId: type.id,
              startsAt: slot.startsAt.toISOString(),
              durationId: option?.id ?? null,
            },
            title: option ? `${type.name} · ${option.label}` : type.name,
            day:
              slot.startsAt < tomorrow
                ? "today"
                : slot.startsAt < afterTomorrow
                  ? "tomorrow"
                  : "later",
            time: clock.format(slot.startsAt),
            duration: durationLabel(
              Math.round((slot.endsAt.getTime() - slot.startsAt.getTime()) / 60_000),
            ),
            date: weekday.format(slot.startsAt).replace(/^./, (first) => first.toUpperCase()),
            label: `${formatWeekdayShort(slot.startsAt, timeZone)} ${formatDayNumber(slot.startsAt, timeZone)} · ${formatHour(slot.startsAt, timeZone)}`,
            range: `${clock.format(slot.startsAt)} – ${clock.format(slot.endsAt)}`,
            location: settings.address ?? null,
            priceCents,
            paymentMode: priceCents > 0 ? (modules.deposit ? "deposit" : "on_site") : "free",
            modules: {
              ...(modules.duration && { duration: modules.duration }),
              ...(modules.pricing && { pricing: modules.pricing }),
              ...(modules.payment_methods && { payment_methods: modules.payment_methods }),
            },
            color: type.color,
            remaining: seatsLeft,
            capacity: type.modules.slots?.seatsPerSlot ?? 1,
            waitlist: false,
            seriesId: null,
            enrollmentPriceCents: null,
            enrollmentNote: null,
            fields: type.fields.filter((field) => field.scope !== "event"),
            rules: formRules(type.rules, type.fields, {
              fieldValues: {},
              capacity: null,
              seatsHeld: 0,
            }),
          });
        }
      }
    }
    return entries;
  });
}
