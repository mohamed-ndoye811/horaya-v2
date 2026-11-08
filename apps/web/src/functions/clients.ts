import {
  countCustomersBySegment,
  getCustomerDetail,
  getCustomerStats,
  listCustomerBookings,
  listCustomerPasses,
  listCustomers,
  listPassPlans,
} from "@horaya/db";
import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { startOfDay, todayIn } from "@/lib/dates";
import { formDataInput } from "@/lib/form-data";
import { addNote, saveCustomer as save } from "@/server/clients";
import { db } from "@/server/db";
import type { FormState } from "@/server/form-state";
import { getWorkspaceContext } from "@/server/workspace";

export const CUSTOMER_SEGMENTS = ["all", "vip", "company", "inactive"] as const;

/** Filtres de l'écran 22, tels qu'ils sont dans l'adresse. */
export const customersSearch = z.object({
  segment: z.enum(CUSTOMER_SEGMENTS).optional().catch(undefined),
  q: z.string().optional(),
});

/** Données de l'écran 22 : clients filtrés, compteurs des segments, chiffres du mois. */
export const getCustomers = createServerFn({ method: "GET" })
  .validator(customersSearch)
  .handler(async ({ data }) => {
    const { workspace, timeZone } = await getWorkspaceContext();
    const now = new Date();
    const today = todayIn(timeZone, now);
    const [rows, counts, stats] = await Promise.all([
      listCustomers(db, workspace.id, { segment: data.segment ?? "all", now, search: data.q }),
      countCustomersBySegment(db, workspace.id, now),
      getCustomerStats(db, workspace.id, startOfDay({ ...today, day: 1 }, timeZone)),
    ]);
    return { timeZone, rows, counts, stats };
  });

/** Fiche client (maquette 2.2) : client, notes et historique des réservations. */
export const getCustomer = createServerFn({ method: "GET" })
  .validator(z.string().uuid())
  .handler(async ({ data: id }) => {
    const { workspace, timeZone } = await getWorkspaceContext();
    const [detail, bookings, passes, plans] = await Promise.all([
      getCustomerDetail(db, workspace.id, id, new Date()),
      listCustomerBookings(db, workspace.id, id),
      listCustomerPasses(db, workspace.id, id),
      listPassPlans(db, workspace.id),
    ]);
    if (!detail) throw notFound();
    return {
      timeZone,
      customer: detail.customer,
      notes: detail.notes,
      bookings,
      passes,
      sellablePlans: plans.filter((plan) => !plan.archivedAt),
    };
  });

/** Valeurs du formulaire de modification (client anonymisé : introuvable). */
export const getCustomerForEdit = createServerFn({ method: "GET" })
  .validator(z.string().uuid())
  .handler(async ({ data: id }) => {
    const { workspace } = await getWorkspaceContext();
    const detail = await getCustomerDetail(db, workspace.id, id, new Date());
    if (!detail || detail.customer.anonymizedAt) throw notFound();
    const { customer } = detail;
    return {
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      company: customer.company ?? "",
      tags: customer.tags.join(", "),
      marketingConsent: customer.marketingConsent,
    };
  });

/** Identifiant de la fiche, glissé dans le formulaire envoyé. */
const ID_FIELD = "_id";
const idOf = (form: FormData) => String(form.get(ID_FIELD) ?? "") || null;

const saveFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => save(idOf(data), data));
const noteFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => addNote(idOf(data) ?? "", data));

/** Ajout (customerId null) ou modification d'un client ; renvoie vers sa fiche. */
export function saveCustomer(customerId: string | null, _previous: FormState, form: FormData) {
  form.set(ID_FIELD, customerId ?? "");
  return saveFn({ data: form });
}

export function addNoteAction(customerId: string, _previous: FormState, form: FormData) {
  form.set(ID_FIELD, customerId);
  return noteFn({ data: form });
}
