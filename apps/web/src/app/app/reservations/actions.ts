"use server";

import {
  cancelBooking,
  confirmBooking,
  createEventBooking,
  recordManualPayment,
  recordManualRefund,
  refundBooking,
  refuseBooking,
} from "@horaya/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseEuroToCents } from "@/lib/money";
import { sendBookingCreatedEmail } from "@/server/booking-emails";
import { type FormState, toFormState } from "@/server/form-state";
import { paymentDeps } from "@/server/payments";
import { deps } from "@/server/services";
import { getWorkspaceContext } from "@/server/workspace";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

async function run(work: () => Promise<unknown>, success: string): Promise<FormState> {
  try {
    await work();
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath("/app", "layout");
  return { success };
}

export async function confirmBookingAction(bookingId: string): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  return run(() => confirmBooking(deps, actor, bookingId), "Réservation validée.");
}

export async function refuseBookingAction(bookingId: string, reason: string): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  return run(() => refuseBooking(deps, actor, bookingId, reason), "Demande refusée.");
}

export async function cancelBookingAction(bookingId: string, reason: string): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  return run(() => cancelBooking(deps, actor, bookingId, reason), "Réservation annulée.");
}

/** « Ajouter une réservation » : l'équipe inscrit un client (nouveau ou existant). */
export async function createBookingAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  let bookingId: string;
  try {
    const { booking, manageToken } = await createEventBooking(deps, actor, {
      eventId: text(form, "eventId"),
      seats: Number(text(form, "seats") || 1),
      customer: {
        firstName: text(form, "firstName"),
        lastName: text(form, "lastName"),
        email: text(form, "email"),
        phone: text(form, "phone") || null,
        company: text(form, "company") || null,
      },
      customerMessage: text(form, "customerMessage") || null,
    });
    bookingId = booking.id;
    // Le client reçoit sa confirmation et son lien « Gérer ma réservation ».
    await sendBookingCreatedEmail(actor.organizationId, booking.id, manageToken);
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath("/app", "layout");
  redirect(`/app/reservations/${bookingId}`);
}

/** « Rembourser » sur la fiche d'une réservation payée en ligne. */
export async function refundBookingAction(bookingId: string, amount: string): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  const cents = parseEuroToCents(amount);
  if (!Number.isInteger(cents) || cents <= 0) return { error: "Montant invalide." };
  const deps = paymentDeps;
  if (!deps)
    return { error: "Le paiement en ligne n'est pas activé : note le remboursement à la place." };
  return run(() => refundBooking(deps, actor, bookingId, cents), "Remboursement envoyé.");
}

/** « Marquer comme payé » : paiement reçu hors Horaya (lien externe, espèces, virement…). */
export async function markPaidAction(bookingId: string, amount: string): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  const cents = parseEuroToCents(amount);
  if (!Number.isInteger(cents) || cents <= 0) return { error: "Montant invalide." };
  return run(
    () => recordManualPayment(deps, actor, bookingId, cents),
    "Paiement noté, reçu envoyé au client.",
  );
}

/** « Noter un remboursement » : argent rendu hors Horaya. */
export async function recordRefundAction(bookingId: string, amount: string): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  const cents = parseEuroToCents(amount);
  if (!Number.isInteger(cents) || cents <= 0) return { error: "Montant invalide." };
  return run(() => recordManualRefund(deps, actor, bookingId, cents), "Remboursement noté.");
}
