"use server";

import {
  cancelMaintenance,
  createItem,
  createRentalBooking,
  fromZonedParts,
  importItems,
  scheduleMaintenance,
  setItemQuantity,
  updateItem,
} from "@horaya/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseCivilDate } from "@/lib/dates";
import { parseEuroToCents } from "@/lib/money";
import { type FormState, toFormState } from "@/server/form-state";
import { deps } from "@/server/services";
import { getWorkspaceContext } from "@/server/workspace";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const optionalCents = (value: string) => (value === "" ? null : parseEuroToCents(value));

/** Date (AAAA-MM-JJ) + heure (HH:MM, 00:00 par défaut) dans le fuseau de l'espace. */
function zoned(
  form: FormData,
  dateKey: string,
  timeKey: string | null,
  timeZone: string,
): Date | string {
  const date = parseCivilDate(text(form, dateKey));
  const time = (timeKey ? text(form, timeKey) : "00:00").match(/^(\d{2}):(\d{2})$/);
  if (!date || !time) return "date invalide";
  return fromZonedParts({ ...date, hour: Number(time[1]), minute: Number(time[2]) }, timeZone);
}

function itemFields(form: FormData) {
  return {
    name: text(form, "name"),
    reference: text(form, "reference"),
    typeName: text(form, "typeName") || null,
    description: text(form, "description") || null,
    dailyRateCents: optionalCents(text(form, "dailyRate")),
    depositCents: optionalCents(text(form, "deposit")),
    storageLocation: text(form, "storageLocation") || null,
    purchasedOn: text(form, "purchasedOn") || null,
    purchasePriceCents: optionalCents(text(form, "purchasePrice")),
    rentable: form.get("rentable") === "on",
  };
}

/** Ajout (itemId null) ou modification d'un article, quantité comprise. */
export async function saveItem(
  itemId: string | null,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  const quantity = Number(text(form, "quantity") || 0);
  let targetId: string;
  try {
    if (itemId) {
      await updateItem(deps, actor, itemId, itemFields(form));
      await setItemQuantity(deps, actor, itemId, quantity);
      targetId = itemId;
    } else {
      const created = await createItem(deps, actor, { ...itemFields(form), quantity });
      targetId = created.id;
    }
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath("/app", "layout");
  redirect(`/app/materiel/${targetId}`);
}

export async function scheduleMaintenanceAction(
  itemId: string,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const { actor, timeZone } = await getWorkspaceContext();
  try {
    await scheduleMaintenance(deps, actor, {
      itemId,
      unitIds: form.getAll("unitIds").map(String),
      startsAt: zoned(form, "startDate", null, timeZone) as Date,
      // Fin incluse : jusqu'au lendemain minuit du dernier jour.
      endsAt: (() => {
        const end = zoned(form, "endDate", null, timeZone);
        return typeof end === "string" ? end : new Date(end.getTime() + 86_400_000);
      })() as Date,
      title: text(form, "title"),
      provider: text(form, "provider") || null,
      costCents: optionalCents(text(form, "cost")),
      note: text(form, "note") || null,
    });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(`/app/materiel/${itemId}`);
  revalidatePath("/app/materiel");
  return { success: "Intervention planifiée." };
}

/** Annule une intervention (toutes les lignes d'exemplaires planifiées ensemble). */
export async function cancelMaintenanceAction(allocationIds: string[]): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    for (const allocationId of allocationIds) await cancelMaintenance(deps, actor, allocationId);
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath("/app", "layout");
  return { success: "Intervention annulée." };
}

/** « Réserver » sur la fiche article : location de matériel seule. */
export async function createRentalAction(
  itemId: string,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const { actor, timeZone } = await getWorkspaceContext();
  let bookingId: string;
  try {
    const created = await createRentalBooking(deps, actor, {
      itemId,
      quantity: Number(text(form, "quantity") || 1),
      startsAt: zoned(form, "startDate", "startTime", timeZone) as Date,
      endsAt: zoned(form, "endDate", "endTime", timeZone) as Date,
      customer: {
        firstName: text(form, "firstName"),
        lastName: text(form, "lastName"),
        email: text(form, "email"),
        phone: text(form, "phone") || null,
        company: text(form, "company") || null,
      },
      customerMessage: text(form, "customerMessage") || null,
    });
    bookingId = created.bookingId;
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath("/app", "layout");
  redirect(`/app/reservations/${bookingId}`);
}

/** « Importer CSV » (écran 20) : tout le fichier est importé, ou rien. */
export async function importItemsAction(_previous: FormState, form: FormData): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisis un fichier CSV." };
  if (file.size > 900_000) return { error: "Fichier trop lourd : 900 Ko maximum." };
  let count: number;
  try {
    count = (await importItems(deps, actor, await file.text())).length;
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath("/app/materiel");
  return { success: `${count} article${count > 1 ? "s" : ""} importé${count > 1 ? "s" : ""}.` };
}
