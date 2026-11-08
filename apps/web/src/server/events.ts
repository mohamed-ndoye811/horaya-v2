/** Événements, types et liens calendrier : logique serveur des actions (voir functions/events.ts). */
import {
  archiveEventType,
  type CalendarLinkFilter,
  type CreateEventInput,
  type CreateEventTypeInput,
  cancelEvent,
  createCalendarLink,
  createEvent,
  createEventType,
  deleteCalendarLink,
  fromZonedParts,
  keepEventDespiteMinimum,
  publishEvent,
  removeEventItem,
  setEventItemQuantity,
  type UpdateEventInput,
  type UpdateEventTypeInput,
  updateCalendarLink,
  updateEvent,
  updateEventType,
} from "@horaya/core";
import { redirect } from "@tanstack/react-router";
import { parseCivilDate } from "@/lib/dates";
import { rawFieldValues } from "@/lib/fields";
import { parseEuroToCents } from "@/lib/money";
import { type FormState, toFormState } from "./form-state";
import { deps } from "./services";
import { getWorkspaceContext } from "./workspace";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/** Date (AAAA-MM-JJ) + heure (HH:MM) saisies dans le fuseau de l'espace → instant UTC. */
function zoned(form: FormData, dateKey: string, timeKey: string, timeZone: string): Date | null {
  const date = parseCivilDate(text(form, dateKey));
  const time = text(form, timeKey).match(/^(\d{2}):(\d{2})$/);
  if (!date || !time) return null;
  return fromZonedParts({ ...date, hour: Number(time[1]), minute: Number(time[2]) }, timeZone);
}

function eventFields(form: FormData, timeZone: string) {
  const startsAt = zoned(form, "startDate", "startTime", timeZone);
  const endsAt = zoned(form, "endDate", "endTime", timeZone);
  const capacity = text(form, "capacity");
  const paymentMode = text(form, "paymentMode") || "free";
  const deposit = text(form, "depositPercent");
  return {
    title: text(form, "title"),
    description: text(form, "description"),
    visibility: text(form, "visibility") || "public",
    // Valeurs invalides laissées telles quelles : la validation du core renvoie le bon message.
    startsAt: startsAt ?? "date invalide",
    endsAt: endsAt ?? "date invalide",
    timezone: timeZone,
    locationName: text(form, "locationName") || null,
    onlineUrl: text(form, "onlineUrl") || null,
    capacity: capacity === "" ? null : Number(capacity),
    priceCents: paymentMode === "free" ? 0 : parseEuroToCents(text(form, "price")),
    paymentMode,
    depositPercent: paymentMode === "deposit" && deposit !== "" ? Number(deposit) : null,
    paymentLinkUrl:
      paymentMode === "online" || paymentMode === "deposit"
        ? text(form, "paymentLinkUrl") || null
        : null,
    requiresApproval: form.get("requiresApproval") === "on",
    highlights: text(form, "highlights")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
    // « Ce que tu décris » : validé par le core contre les champs de l'événement.
    fieldValues: rawFieldValues(form, "f."),
  };
}

/** Création (écran 09) ou modification d'un événement ; « Publier » enchaîne la publication. */
export async function saveEvent(eventId: string | null, form: FormData): Promise<FormState> {
  const { actor, timeZone } = await getWorkspaceContext();
  const publish = form.get("intent") === "publish";
  let targetId: string;

  try {
    const fields = eventFields(form, timeZone);
    if (eventId) {
      await updateEvent(deps, actor, eventId, fields as unknown as UpdateEventInput);
      targetId = eventId;
    } else {
      const recurring = form.get("recurring") === "on";
      const created = await createEvent(deps, actor, {
        ...(fields as unknown as Omit<CreateEventInput, "eventTypeId">),
        eventTypeId: text(form, "eventTypeId"),
        recurrence: recurring
          ? {
              frequency: text(form, "frequency") as "daily" | "weekly" | "monthly",
              interval: Number(text(form, "interval") || 1),
              count: Number(text(form, "count") || 0),
            }
          : undefined,
      });
      const first = created[0];
      if (!first) return { error: "Aucun événement créé." };
      targetId = first.id;
      if (publish) for (const occurrence of created) await publishEvent(deps, actor, occurrence.id);
    }
    if (eventId && publish) await publishEvent(deps, actor, eventId);
  } catch (error) {
    return toFormState(error);
  }

  throw redirect({ href: `/app/evenements/${targetId}` });
}

export async function publishEventActionImpl(eventId: string): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    await publishEvent(deps, actor, eventId);
  } catch (error) {
    return toFormState(error);
  }
  return { success: "Événement publié." };
}

/** « Maintenir quand même » : l'événement ne sera pas annulé faute d'inscrits. */
export async function keepEventActionImpl(eventId: string): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    await keepEventDespiteMinimum(deps, actor, eventId);
  } catch (error) {
    return toFormState(error);
  }
  return { success: "Événement maintenu, quel que soit le nombre d'inscrits." };
}

export async function cancelEventActionImpl(eventId: string, reason: string): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    const { cancelledBookings } = await cancelEvent(deps, actor, eventId, reason || undefined);
    return {
      success:
        cancelledBookings > 0
          ? `Événement annulé, ${cancelledBookings} réservation${cancelledBookings > 1 ? "s" : ""} annulée${cancelledBookings > 1 ? "s" : ""}.`
          : "Événement annulé.",
    };
  } catch (error) {
    return toFormState(error);
  }
}

const DURATIONS: Record<string, number | null> = {
  "": null,
  "30": 30,
  "60": 60,
  "90": 90,
  "120": 120,
  "150": 150,
  "180": 180,
  "240": 240,
  "1440": 1440,
};

/** Création ou modification d'un type d'événement (maquette 9.1). */
export async function saveEventType(typeId: string | null, form: FormData): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  const price = text(form, "defaultPrice");

  // Champs et modules arrivent en JSON ; le core les valide (schémas des champs et des modules).
  let fields: unknown;
  let modules: unknown;
  try {
    fields = JSON.parse(text(form, "fields") || "[]");
    modules = JSON.parse(text(form, "modules") || "{}");
  } catch {
    return { error: "Réglages illisibles." };
  }

  const input = {
    name: text(form, "name"),
    color: text(form, "color"),
    bookingNoun: text(form, "bookingNoun") || "reservation",
    defaultDurationMinutes: DURATIONS[text(form, "defaultDuration")] ?? null,
    defaultPriceCents: price === "" ? null : parseEuroToCents(price),
    fields,
    modules,
  };

  let savedId: string;
  try {
    const saved = typeId
      ? await updateEventType(deps, actor, typeId, {
          ...(input as unknown as UpdateEventTypeInput),
          applyToUpcoming: form.get("applyToUpcoming") === "on",
        })
      : await createEventType(deps, actor, input as unknown as CreateEventTypeInput);
    savedId = saved.id;
  } catch (error) {
    return toFormState(error);
  }
  throw redirect({ href: `/app/evenements/types?type=${savedId}` });
}

export async function archiveEventTypeActionImpl(typeId: string): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    await archiveEventType(deps, actor, typeId);
  } catch (error) {
    return toFormState(error);
  }
  throw redirect({ href: "/app/evenements/types" });
}

/** Onglet « Matériel » de la fiche événement : fixe la quantité d'un article. */
export async function setEventItemActionImpl(
  eventId: string,
  itemId: string,
  quantity: number,
): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    await setEventItemQuantity(deps, actor, { eventId, itemId, quantity });
  } catch (error) {
    return toFormState(error);
  }
  return { success: "Matériel réservé." };
}

export async function removeEventItemActionImpl(
  eventId: string,
  itemId: string,
): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    await removeEventItem(deps, actor, eventId, itemId);
  } catch (error) {
    return toFormState(error);
  }
  return { success: "Matériel libéré." };
}

/* Liens calendrier (/app/evenements/liens). */

function linkFields(form: FormData) {
  return {
    name: String(form.get("name") ?? "").trim(),
    filterMode: String(form.get("filterMode") ?? "") as CalendarLinkFilter,
    filterIds: form.getAll("filterIds").map(String),
  };
}

async function run(work: () => Promise<unknown>, success: string): Promise<FormState> {
  try {
    await work();
  } catch (error) {
    return toFormState(error);
  }
  return { success };
}

/** « Nouveau lien » ou modification (nom et événements montrés). */
export async function saveCalendarLink(linkId: string | null, form: FormData): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  const { name, filterMode, filterIds } = linkFields(form);
  return linkId
    ? run(
        () => updateCalendarLink(deps, actor, linkId, { name, filter: { filterMode, filterIds } }),
        "Lien enregistré.",
      )
    : run(() => createCalendarLink(deps, actor, { name, filterMode, filterIds }), "Lien créé.");
}

export async function setCalendarLinkActiveImpl(
  linkId: string,
  isActive: boolean,
): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  return run(
    () => updateCalendarLink(deps, actor, linkId, { isActive }),
    isActive ? "Lien réactivé." : "Lien désactivé : sa page ne s'ouvre plus.",
  );
}

export async function deleteCalendarLinkImpl(linkId: string): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  return run(() => deleteCalendarLink(deps, actor, linkId), "Lien supprimé.");
}
