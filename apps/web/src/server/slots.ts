/**
 * Créneaux (lot 37, maquette 9.6) : page publique d'un type « sur rendez-vous », créneau gardé
 * pendant le formulaire, puis réservation (voir functions/slots.ts).
 */
import {
  addDays,
  civilKey,
  dayMoment,
  durationOf,
  findSlots,
  holdSlot,
  type Slot,
  withChosenDuration,
} from "@horaya/core";
import { getPublicSlotType, getSlotHold } from "@horaya/db";
import { notFound, redirect } from "@tanstack/react-router";
import { mondayOf, parseCivilDate, todayIn } from "@/lib/dates";
import { db } from "./db";
import { type FormState, toFormState } from "./form-state";
import { customerPrefill, publicWorkspace } from "./public-booking";
import { clientIp, rateLimited } from "./rate-limit";
import { deps } from "./services";

/** Créneaux libres de la semaine, jour par jour (calcul du core, sous une transaction de lecture). */
async function weekSlots(
  organizationId: string,
  typeId: string,
  monday: { year: number; month: number; day: number },
  timeZone: string,
  durationId: string | null,
): Promise<Slot[]> {
  return deps.uow.run(async (repositories) => {
    const eventType = await repositories.eventTypes.find(organizationId, typeId);
    if (!eventType) return [];
    return findSlots(repositories, organizationId, eventType, {
      from: monday,
      days: 7,
      now: new Date(),
      timeZone,
      durationId,
    });
  });
}

/** Maquette 9.6 : durée, jour, heure et intervenant ; `semaine` : le lundi affiché. */
export async function slotPage(
  slug: string,
  typeId: string,
  search: { duree?: string; semaine?: string },
) {
  const workspace = await publicWorkspace(slug);
  const type = await getPublicSlotType(db, workspace.id, typeId);
  if (!type) throw notFound();
  const tz = workspace.timezone;
  const thisWeek = mondayOf(todayIn(tz));
  const asked = parseCivilDate(search.semaine);
  let monday = asked && civilKey(asked) > civilKey(thisWeek) ? mondayOf(asked) : thisWeek;
  const duration = type.duration
    ? (type.duration.options.find((option) => option.id === search.duree) ??
      durationOf(type.duration))
    : null;
  let slots = await weekSlots(workspace.id, type.id, monday, tz, duration?.id ?? null);
  // Semaine en cours déjà pleine (ou finie) : on ouvre d'office sur la suivante.
  if (!asked && slots.length === 0) {
    monday = addDays(monday, 7);
    slots = await weekSlots(workspace.id, type.id, monday, tz, duration?.id ?? null);
  }
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    const key = civilKey(date);
    return {
      date: key,
      slots: slots
        .filter((slot) => civilKey(todayIn(tz, slot.startsAt)) === key)
        .map((slot) => ({
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          moment: dayMoment(slot.startsAt, tz),
          staffIds: [...new Set(slot.options.map((option) => option.staffMemberId))].filter(
            (id): id is string => id !== null,
          ),
        })),
    };
  });
  const { fields: _fields, rules: _rules, ...publicType } = type;
  return {
    workspace,
    type: publicType,
    durationId: duration?.id ?? null,
    monday: civilKey(monday),
    previous: civilKey(monday) > civilKey(thisWeek) ? civilKey(addDays(monday, -7)) : null,
    next: civilKey(addDays(monday, 7)),
    days,
  };
}

/** « Continuer » : le créneau est gardé 10 minutes, puis le formulaire. */
export async function holdPublicSlot(
  slug: string,
  typeId: string,
  choice: { startsAt: string; durationId: string | null; staffMemberId: string | null },
): Promise<FormState> {
  const workspace = await publicWorkspace(slug);
  const blocked = await rateLimited(`slot:ip:${await clientIp()}`, 30, 3600);
  if (blocked) return { error: blocked };
  let holdId: string;
  try {
    const hold = await holdSlot(
      deps,
      { type: "customer", organizationId: workspace.id },
      {
        eventTypeId: typeId,
        startsAt: choice.startsAt,
        durationId: choice.durationId,
        staffMemberId: choice.staffMemberId,
      },
    );
    holdId = hold.id;
  } catch (error) {
    return toFormState(error);
  }
  throw redirect({ href: `/${slug}/creneaux/${typeId}/reserver?creneau=${holdId}` });
}

/** Le formulaire du créneau gardé ; plus de créneau : retour au choix. */
export async function slotBookPage(slug: string, typeId: string, holdId: string | undefined) {
  const workspace = await publicWorkspace(slug);
  const type = await getPublicSlotType(db, workspace.id, typeId);
  if (!type) throw notFound();
  const hold = holdId?.match(/^[0-9a-f-]{36}$/)
    ? await getSlotHold(db, workspace.id, holdId)
    : null;
  if (!hold || hold.eventTypeId !== type.id) {
    throw redirect({ href: `/${slug}/creneaux/${typeId}` });
  }
  const duration = type.duration ? durationOf(type.duration, hold.durationId) : null;
  const priceCents = duration?.priceCents ?? type.defaultPriceCents ?? 0;
  return {
    workspace,
    type,
    hold: {
      id: hold.id,
      startsAt: hold.startsAt,
      endsAt: hold.endsAt,
      expiresAt: hold.expiresAt,
      seats: hold.seats,
      staffFirstName: hold.staffName?.split(" ")[0] ?? null,
    },
    // Le prix comme le calculera la réservation : la durée choisie fixe le prix de la place.
    priced: {
      priceCents,
      paymentMode:
        priceCents === 0
          ? ("free" as const)
          : type.modules.deposit
            ? ("deposit" as const)
            : ("on_site" as const),
      modules: duration ? withChosenDuration(type.modules, duration) : type.modules,
    },
    prefill: await customerPrefill(),
    now: new Date(),
  };
}
