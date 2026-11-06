import { addDays } from "@horaya/core";
import {
  getCustomerDetail,
  getInventoryStats,
  getItemDetail,
  listItems,
  listItemTypeNames,
} from "@horaya/db";
import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { addMonths, parseCivilDate, startOfDay, todayIn } from "@/lib/dates";
import { formDataInput } from "@/lib/form-data";
import { db } from "@/server/db";
import type { FormState } from "@/server/form-state";
import {
  cancelMaintenanceAction as cancelMaintenance,
  createRentalAction as createRental,
  importItemsAction as importItems,
  saveItem as save,
  scheduleMaintenanceAction as scheduleMaintenance,
} from "@/server/inventory";
import { getWorkspaceContext } from "@/server/workspace";

export const ITEM_TABS = ["all", "available", "out", "maintenance"] as const;

/** Filtres de l'écran 20, tels qu'ils sont dans l'adresse. */
export const inventorySearch = z.object({
  filtre: z.enum(ITEM_TABS).optional().catch(undefined),
  q: z.string().optional(),
});

/** Données de l'écran 20 : articles filtrés, tous les articles (compteurs), chiffres. */
export const getInventory = createServerFn({ method: "GET" })
  .validator(inventorySearch)
  .handler(async ({ data }) => {
    const { workspace, timeZone } = await getWorkspaceContext();
    const now = new Date();
    const today = todayIn(timeZone, now);
    const previousMonth = addMonths({ ...today, day: 1 }, -1);
    const [rows, all, stats] = await Promise.all([
      listItems(db, workspace.id, { tab: data.filtre ?? "all", now, search: data.q }),
      listItems(db, workspace.id, { tab: "all", now }),
      getInventoryStats(db, workspace.id, {
        now,
        dayEnd: startOfDay(addDays(today, 1), timeZone),
        monthStart: startOfDay({ ...today, day: 1 }, timeZone),
        previousMonthStart: startOfDay(previousMonth, timeZone),
      }),
    ]);
    const counts = {
      all: all.length,
      available: all.filter((row) => row.availableNow > 0).length,
      out: all.filter((row) => row.availableNow < row.units - row.inMaintenanceNow).length,
      maintenance: all.filter((row) => row.inMaintenanceNow > 0).length,
    };
    return { timeZone, today, rows, counts, stats };
  });

/** Catégories déjà utilisées (suggestions du formulaire d'article). */
export const getItemTypes = createServerFn({ method: "GET" }).handler(async () => {
  const { workspace } = await getWorkspaceContext();
  return listItemTypeNames(db, workspace.id);
});

const DAYS = 14;

/** Fiche article (écran 21) : planning de ses exemplaires sur 14 jours à partir de « du ». */
export const getItem = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().uuid(), du: z.string().optional() }))
  .handler(async ({ data }) => {
    const { workspace, timeZone } = await getWorkspaceContext();
    const now = new Date();
    const today = todayIn(timeZone, now);
    const first = parseCivilDate(data.du ?? "") ?? today;
    const detail = await getItemDetail(db, workspace.id, data.id, {
      from: startOfDay(first, timeZone),
      to: startOfDay(addDays(first, DAYS), timeZone),
      now,
    });
    if (!detail || detail.item.archivedAt) throw notFound();
    return { timeZone, today, first, detail };
  });

/** Article à modifier, avec les catégories existantes. */
export const getItemForEdit = createServerFn({ method: "GET" })
  .validator(z.string().uuid())
  .handler(async ({ data: id }) => {
    const { workspace } = await getWorkspaceContext();
    const now = new Date();
    const [detail, types] = await Promise.all([
      getItemDetail(db, workspace.id, id, { from: now, to: now, now }),
      listItemTypeNames(db, workspace.id),
    ]);
    if (!detail || detail.item.archivedAt) throw notFound();
    return { item: detail.item, types };
  });

/** Formulaire « Louer » : l'article, et le client prérempli (?client=…). */
export const getItemRental = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().uuid(), client: z.string().uuid().optional() }))
  .handler(async ({ data }) => {
    const { workspace, timeZone } = await getWorkspaceContext();
    const now = new Date();
    const [detail, customer] = await Promise.all([
      getItemDetail(db, workspace.id, data.id, { from: now, to: now, now }),
      data.client ? getCustomerDetail(db, workspace.id, data.client, now) : null,
    ]);
    if (!detail || detail.item.archivedAt) throw notFound();
    return {
      item: detail.item,
      tomorrow: addDays(todayIn(timeZone, now), 1),
      customer: customer?.customer,
    };
  });

/*
 * Formulaires : mêmes noms que les anciennes Server Actions. L'identifiant lié (bind) est glissé
 * dans le FormData envoyé.
 */
const ID_FIELD = "_id";
const idOf = (form: FormData) => String(form.get(ID_FIELD) ?? "");

const saveFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => save(idOf(data) || null, data));
const scheduleFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => scheduleMaintenance(idOf(data), data));
const cancelFn = createServerFn({ method: "POST" })
  .validator(z.array(z.string().uuid()).max(1000))
  .handler(({ data }) => cancelMaintenance(data));
const rentalFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => createRental(idOf(data), data));
const importFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => importItems(data));

/** Ajout (itemId null) ou modification d'un article ; renvoie vers sa fiche. */
export function saveItem(itemId: string | null, _previous: FormState, form: FormData) {
  form.set(ID_FIELD, itemId ?? "");
  return saveFn({ data: form });
}

export function scheduleMaintenanceAction(itemId: string, _previous: FormState, form: FormData) {
  form.set(ID_FIELD, itemId);
  return scheduleFn({ data: form });
}

export const cancelMaintenanceAction = (allocationIds: string[]) =>
  cancelFn({ data: allocationIds });

/** Location seule ; renvoie vers la réservation créée. */
export function createRentalAction(itemId: string, _previous: FormState, form: FormData) {
  form.set(ID_FIELD, itemId);
  return rentalFn({ data: form });
}

export const importItemsAction = (_previous: FormState, form: FormData) => importFn({ data: form });
