import {
  getCustomerPassSummary,
  getPublicPassPlan,
  listActivePasses,
  listEventTypes,
  listPassPlans,
  listPendingPasses,
  listPublicPassPlans,
} from "@horaya/db";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { formDataInput } from "@/lib/form-data";
import { searchText } from "@/lib/search-params";
import { db } from "@/server/db";
import type { FormState } from "@/server/form-state";
import {
  adjustPassImpl,
  archivePassPlanImpl,
  cancelPendingPassImpl,
  counterPassesImpl,
  currentCustomerIdentity,
  markPassPaidImpl,
  payBookingWithPassImpl,
  payWithMyPassImpl,
  purchasePassImpl,
  savePassPlanImpl,
  sellPassImpl,
} from "@/server/passes";
import { publicWorkspace } from "@/server/public-booking";
import { getWorkspaceContext } from "@/server/workspace";

const id = z.string().uuid();
const ID_FIELD = "_id";
const idOf = (form: FormData) => String(form.get(ID_FIELD) ?? "") || null;

/* ---------- Organisateur ---------- */

export const passesSearch = z.object({ formule: searchText });

/** Page « Cartes » : formules, cartes en cours et à encaisser, types pour le formulaire. */
export const getPassesPage = createServerFn({ method: "GET" }).handler(async () => {
  const { workspace, timeZone } = await getWorkspaceContext();
  const now = new Date();
  const [plans, pending, active, eventTypes] = await Promise.all([
    listPassPlans(db, workspace.id),
    listPendingPasses(db, workspace.id),
    listActivePasses(db, workspace.id, now),
    listEventTypes(db, workspace.id),
  ]);
  return {
    timeZone,
    slug: workspace.slug,
    now: now.toISOString(),
    active: active.map((entry) => ({
      ...entry,
      expiresAt: entry.expiresAt?.toISOString() ?? null,
    })),
    plans: plans.map((plan) => ({ ...plan, archivedAt: plan.archivedAt?.toISOString() ?? null })),
    pending: pending.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() })),
    eventTypes: eventTypes.map((type) => ({ id: type.id, name: type.name })),
  };
});

const savePlanFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => savePassPlanImpl(idOf(data), data));
const archivePlanFn = createServerFn({ method: "POST" })
  .validator(z.object({ planId: id, archived: z.boolean() }))
  .handler(({ data }) => archivePassPlanImpl(data.planId, data.archived));
const sellFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => sellPassImpl(data));
const markPaidFn = createServerFn({ method: "POST" })
  .validator(z.object({ passId: id, method: z.string().max(20) }))
  .handler(({ data }) => markPassPaidImpl(data.passId, data.method));
const cancelPendingFn = createServerFn({ method: "POST" })
  .validator(id)
  .handler(({ data }) => cancelPendingPassImpl(data));
const adjustFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => adjustPassImpl(idOf(data) ?? "", data));
const payBookingFn = createServerFn({ method: "POST" })
  .validator(z.object({ bookingId: id, passId: id }))
  .handler(({ data }) => payBookingWithPassImpl(data.bookingId, data.passId));
const counterPassesFn = createServerFn({ method: "POST" })
  .validator(z.object({ customerId: id, eventId: id }))
  .handler(({ data }) => counterPassesImpl(data.customerId, data.eventId));

/** Création (planId null) ou modification d'une formule ; renvoie vers son panneau. */
export function savePassPlan(planId: string | null, _previous: FormState, form: FormData) {
  form.set(ID_FIELD, planId ?? "");
  return savePlanFn({ data: form });
}
export const archivePassPlanAction = (planId: string, archived: boolean) =>
  archivePlanFn({ data: { planId, archived } });
/** Vente d'une carte depuis la fiche client (`customerId` dans le formulaire). */
export function sellPassAction(_previous: FormState, form: FormData) {
  return sellFn({ data: form });
}
export const markPassPaidAction = (passId: string, method: string) =>
  markPaidFn({ data: { passId, method } });
export const cancelPendingPassAction = (passId: string) => cancelPendingFn({ data: passId });
export function adjustPassAction(passId: string, _previous: FormState, form: FormData) {
  form.set(ID_FIELD, passId);
  return adjustFn({ data: form });
}
export const payBookingWithPassAction = (bookingId: string, passId: string) =>
  payBookingFn({ data: { bookingId, passId } });
/** Comptoir : cartes utilisables du client pour cette séance. */
export const counterPassesAction = (customerId: string, eventId: string) =>
  counterPassesFn({ data: { customerId, eventId } });

/* ---------- Public ---------- */

const slug = z.string().max(80);

export const getPublicPassesPage = createServerFn({ method: "GET" })
  .validator(slug)
  .handler(async ({ data }) => {
    const workspace = await publicWorkspace(data);
    const [plans, types] = await Promise.all([
      listPublicPassPlans(db, workspace.id),
      listEventTypes(db, workspace.id),
    ]);
    const names = new Map(types.map((type) => [type.id, type.name]));
    return {
      workspace,
      // Ce que la carte permet de réserver, en clair (aucun type : tout).
      plans: plans.map(({ eventTypeIds, ...plan }) => ({
        ...plan,
        types: eventTypeIds.flatMap((id) => names.get(id) ?? []),
      })),
    };
  });

export const getPassThanksPage = createServerFn({ method: "GET" })
  .validator(z.object({ slug, formule: z.string().max(60).optional() }))
  .handler(async ({ data }) => {
    const workspace = await publicWorkspace(data.slug);
    const plan =
      data.formule && z.uuid().safeParse(data.formule).success
        ? await getPublicPassPlan(db, workspace.id, data.formule)
        : null;
    return { workspace, plan };
  });

const purchaseFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => purchasePassImpl(String(data.get("_slug") ?? ""), data));

/** « Acheter une carte » : coordonnées et formule ; renvoie vers la page de remerciement. */
export function purchasePassAction(pageSlug: string, _previous: FormState, form: FormData) {
  form.set("_slug", pageSlug);
  return purchaseFn({ data: form });
}

/* ---------- Espace client (lot 29) ---------- */

const payWithMyPassFn = createServerFn({ method: "POST" })
  .validator(z.object({ slug, bookingId: id, passId: id }))
  .handler(({ data }) => payWithMyPassImpl(data.slug, data.bookingId, data.passId));

/** Le client connecté règle sa réservation avec sa carte (identité lue côté serveur). */
export const payWithMyPassAction = (pageSlug: string, bookingId: string, passId: string) =>
  payWithMyPassFn({ data: { slug: pageSlug, bookingId, passId } });

/**
 * Données du bloc « Ma carte de séances » : séances restantes, total et date de fin de chaque
 * carte utilisable du client connecté (liste vide sans connexion). Le lot 29 l'appelle depuis
 * le loader de l'accueil de l'espace client et passe le résultat à <PassBalanceCard />.
 */
export const getMyPassSummary = createServerFn({ method: "GET" })
  .validator(slug)
  .handler(async ({ data }) => {
    const workspace = await publicWorkspace(data);
    const identity = await currentCustomerIdentity(workspace.id);
    if (!identity) return { passes: [] };
    const passes = await getCustomerPassSummary(db, workspace.id, identity.customerId, new Date());
    return {
      passes: passes.map((entry) => ({ ...entry, expiresAt: entry.expiresAt.toISOString() })),
    };
  });
