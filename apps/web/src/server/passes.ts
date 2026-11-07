/** Cartes de séances : logique serveur des formulaires (voir functions/passes.ts). */
import {
  adjustPass,
  cancelPendingPass,
  createPassPlan,
  markPassPaid,
  PAYMENT_METHODS,
  type PassPlanInput,
  type PaymentMethod,
  payBookingWithPass,
  payBookingWithPassAsCustomer,
  purchasePassPublic,
  sellPass,
  setPassPlanArchived,
  updatePassPlan,
} from "@horaya/core";
import { getEventTypeById, listUsablePasses } from "@horaya/db";
import { redirect } from "@tanstack/react-router";
import { parseEuroToCents } from "@/lib/money";
import { db } from "./db";
import { type FormState, toFormState } from "./form-state";
import { getWorkspaceBySlug } from "./public";
import { clientIp, rateLimited } from "./rate-limit";
import { deps } from "./services";
import { getWorkspaceContext } from "./workspace";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const method = (form: FormData): PaymentMethod | null =>
  PAYMENT_METHODS.find((entry) => entry === text(form, "paymentMethod")) ?? null;

/** Création (planId null) ou modification d'une formule ; renvoie vers son panneau. */
export async function savePassPlanImpl(planId: string | null, form: FormData): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  const input: PassPlanInput = {
    name: text(form, "name"),
    sessions: Number(text(form, "sessions")),
    priceCents: parseEuroToCents(text(form, "price")),
    validityDays: Number(text(form, "validityDays")),
    eventTypeIds: form.getAll("eventTypeIds").map(String),
  };
  let savedId: string;
  try {
    const saved = planId
      ? await updatePassPlan(deps, actor, planId, input)
      : await createPassPlan(deps, actor, input);
    savedId = saved.id;
  } catch (error) {
    return toFormState(error);
  }
  throw redirect({ href: `/app/cartes?formule=${savedId}` });
}

export async function archivePassPlanImpl(planId: string, archived: boolean): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    await setPassPlanArchived(deps, actor, planId, archived);
  } catch (error) {
    return toFormState(error);
  }
  throw redirect({ href: "/app/cartes" });
}

/** Vente au comptoir depuis la fiche client. */
export async function sellPassImpl(form: FormData): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    await sellPass(deps, actor, {
      customerId: text(form, "customerId"),
      planId: text(form, "planId"),
      paid: form.get("paid") === "on",
      paymentMethod: method(form),
    });
  } catch (error) {
    return toFormState(error);
  }
  return { success: form.get("paid") === "on" ? "Carte active." : "Carte vendue, à encaisser." };
}

export async function markPassPaidImpl(passId: string, paymentMethod: string): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    await markPassPaid(
      deps,
      actor,
      passId,
      PAYMENT_METHODS.find((m) => m === paymentMethod) ?? null,
    );
  } catch (error) {
    return toFormState(error);
  }
  return { success: "Carte active, e-mail envoyé au client." };
}

export async function cancelPendingPassImpl(passId: string): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    await cancelPendingPass(deps, actor, passId);
  } catch (error) {
    return toFormState(error);
  }
  return { success: "Vente annulée." };
}

export async function adjustPassImpl(passId: string, form: FormData): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    await adjustPass(deps, actor, passId, {
      delta: Number(text(form, "delta")),
      reason: text(form, "reason"),
    });
  } catch (error) {
    return toFormState(error);
  }
  return { success: "Ajustement noté dans le journal." };
}

/** « Payer avec la carte » sur une réservation existante (fiche réservation). */
export async function payBookingWithPassImpl(
  bookingId: string,
  passId: string,
): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    await payBookingWithPass(deps, actor, { bookingId, passId });
  } catch (error) {
    return toFormState(error);
  }
  return { success: "Réservation payée avec la carte." };
}

/** Comptoir : cartes utilisables par le client pour le type de la séance choisie. */
export async function counterPassesImpl(customerId: string, eventId: string) {
  const { workspace } = await getWorkspaceContext();
  const eventType = await getEventTypeById(db, workspace.id, eventId);
  const passes = await listUsablePasses(db, workspace.id, customerId, eventType, new Date());
  return passes.map((entry) => ({
    id: entry.id,
    name: entry.name,
    balance: entry.balance,
    expiresAt: entry.expiresAt.toISOString(),
  }));
}

/** Page publique : « Acheter une carte ». La carte attend que l'organisateur la marque payée. */
export async function purchasePassImpl(slug: string, form: FormData): Promise<FormState> {
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) return { error: "Espace introuvable." };
  const blocked = await rateLimited(`pass:ip:${await clientIp()}`, 10, 3600);
  if (blocked) return { error: blocked };
  const planId = text(form, "planId");
  try {
    await purchasePassPublic(deps, workspace.id, {
      planId,
      customer: {
        firstName: text(form, "firstName"),
        lastName: text(form, "lastName"),
        email: text(form, "email"),
        phone: text(form, "phone") || null,
        company: null,
      },
    });
  } catch (error) {
    return toFormState(error);
  }
  throw redirect({ href: `/${slug}/cartes/merci?formule=${planId}` });
}

/**
 * POINT D'ACCROCHE du lot 29 (espace client) : renvoie le client connecté à son espace pour
 * cet espace de travail, ou null. À brancher sur la session client une fois qu'elle existe.
 */
export async function currentCustomerIdentity(
  _organizationId: string,
): Promise<{ customerId: string } | null> {
  return null;
}

/** Le client connecté règle sa réservation avec une séance de sa carte. */
export async function payWithMyPassImpl(
  slug: string,
  bookingId: string,
  passId: string,
): Promise<FormState> {
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) return { error: "Espace introuvable." };
  const identity = await currentCustomerIdentity(workspace.id);
  if (!identity) return { error: "Connecte-toi à ton espace pour utiliser ta carte." };
  try {
    await payBookingWithPassAsCustomer(
      deps,
      { organizationId: workspace.id, customerId: identity.customerId },
      { bookingId, passId },
    );
  } catch (error) {
    return toFormState(error);
  }
  return { success: "Réservation payée avec ta carte." };
}
