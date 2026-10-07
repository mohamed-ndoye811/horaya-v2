"use server";

import {
  archiveEventType,
  type CreateEventInput,
  type CreateEventTypeInput,
  cancelEvent,
  createEvent,
  createEventType,
  fromZonedParts,
  publishEvent,
  removeEventItem,
  setEventItemQuantity,
  type UpdateEventInput,
  type UpdateEventTypeInput,
  updateEvent,
  updateEventType,
} from "@horaya/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseCivilDate } from "@/lib/dates";
import { parseEuroToCents } from "@/lib/money";
import { type FormState, toFormState } from "@/server/form-state";
import { deps } from "@/server/services";
import { getWorkspaceContext } from "@/server/workspace";

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
    requiresApproval: form.get("requiresApproval") === "on",
    highlights: text(form, "highlights")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  };
}

/** Création (écran 09) ou modification d'un événement ; « Publier » enchaîne la publication. */
export async function saveEvent(
  eventId: string | null,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
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

  revalidatePath("/app", "layout");
  redirect(`/app/evenements/${targetId}`);
}

export async function publishEventAction(eventId: string): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    await publishEvent(deps, actor, eventId);
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath("/app", "layout");
  return { success: "Événement publié." };
}

export async function cancelEventAction(eventId: string, reason: string): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    const { cancelledBookings } = await cancelEvent(deps, actor, eventId, reason || undefined);
    revalidatePath("/app", "layout");
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

/** Création ou modification d'un type d'événement (écran 16). */
export async function saveEventType(
  typeId: string | null,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  const price = text(form, "defaultPrice");
  const capacity = text(form, "defaultCapacity");
  const fieldsJson = text(form, "customFields") || "[]";
  const minAdvance = text(form, "minAdvanceHours");

  let customFields: unknown;
  try {
    customFields = JSON.parse(fieldsJson);
  } catch {
    return { error: "Champs personnalisés illisibles." };
  }

  const input = {
    name: text(form, "name"),
    color: text(form, "color"),
    description: text(form, "description") || null,
    defaultDurationMinutes: DURATIONS[text(form, "defaultDuration")] ?? null,
    defaultPriceCents: price === "" ? null : parseEuroToCents(price),
    defaultCapacity: capacity === "" ? null : Number(capacity),
    requiresApproval: form.get("requiresApproval") === "on",
    customFields,
    bookingRules: {
      waitlistEnabled: form.get("waitlistEnabled") === "on",
      ...(minAdvance !== "" ? { minAdvanceHours: Number(minAdvance) } : {}),
    },
  };

  let savedId: string;
  try {
    const saved = typeId
      ? await updateEventType(deps, actor, typeId, input as unknown as UpdateEventTypeInput)
      : await createEventType(deps, actor, input as unknown as CreateEventTypeInput);
    savedId = saved.id;
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath("/app", "layout");
  redirect(`/app/evenements/types?type=${savedId}`);
}

export async function archiveEventTypeAction(typeId: string): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    await archiveEventType(deps, actor, typeId);
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath("/app", "layout");
  redirect("/app/evenements/types");
}

/** Onglet « Matériel » de la fiche événement : fixe la quantité d'un article. */
export async function setEventItemAction(
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
  revalidatePath("/app", "layout");
  return { success: "Matériel réservé." };
}

export async function removeEventItemAction(eventId: string, itemId: string): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    await removeEventItem(deps, actor, eventId, itemId);
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath("/app", "layout");
  return { success: "Matériel libéré." };
}
