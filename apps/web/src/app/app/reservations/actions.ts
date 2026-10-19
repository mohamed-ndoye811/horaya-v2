"use server";

import {
  type CounterBookingInput,
  cancelBooking,
  confirmBooking,
  createCounterBooking,
  recordManualPayment,
  recordManualRefund,
  refundBooking,
  refuseBooking,
  setBookingCheckIn,
} from "@horaya/core";
import { listCounterItems, listCustomers } from "@horaya/db";
import { revalidatePath } from "next/cache";
import { parseEuroToCents } from "@/lib/money";
import { sendBookingCreatedEmail } from "@/server/booking-emails";
import { db } from "@/server/db";
import { type FormState, toFormState } from "@/server/form-state";
import { paymentDeps } from "@/server/payments";
import { deps } from "@/server/services";
import { getWorkspaceContext } from "@/server/workspace";

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

/** Check-in du jour J : coche ou décoche l'arrivée d'un participant. */
export async function checkInAction(bookingId: string, present: boolean): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  return run(() => setBookingCheckIn(deps, actor, bookingId, present), "");
}

/** Comptoir, étape 2 : clients qui correspondent (nom, e-mail, téléphone). */
export async function searchCounterCustomersAction(search: string) {
  const { workspace } = await getWorkspaceContext();
  if (search.trim().length < 2) return [];
  const rows = await listCustomers(db, workspace.id, {
    segment: "all",
    now: new Date(),
    search,
    limit: 6,
  });
  return rows.map((row) => ({
    id: row.id,
    name: `${row.firstName} ${row.lastName}`,
    phone: row.phone,
    email: row.email,
    bookings: row.bookings,
  }));
}

/** Comptoir, étape 3 : matériel attribuable sur la séance (déjà prévu pour elle d'abord). */
export async function counterItemsAction(eventId: string) {
  const { workspace } = await getWorkspaceContext();
  const items = await listCounterItems(db, workspace.id, eventId);
  return items
    .filter((item) => item.free > 0 || item.onEvent > 0)
    .sort((a, b) => Number(b.onEvent > 0) - Number(a.onEvent > 0) || a.name.localeCompare(b.name));
}

export type CounterResult =
  | {
      ok: true;
      bookingId: string;
      reference: string;
      status: string;
      paymentStatus: string;
      amountCents: number;
      items: Array<{ name: string; labels: string[] }>;
    }
  | ({ ok: false } & FormState);

/** Comptoir : enregistre la réservation (client, places, matériel, paiement) d'un coup. */
export async function createCounterBookingAction(
  input: CounterBookingInput,
): Promise<CounterResult> {
  const { actor } = await getWorkspaceContext();
  try {
    const { booking, manageToken, items } = await createCounterBooking(deps, actor, input);
    // Confirmation et lien « Gérer ma réservation » si le client a un e-mail.
    await sendBookingCreatedEmail(actor.organizationId, booking.id, manageToken);
    revalidatePath("/app", "layout");
    return {
      ok: true,
      bookingId: booking.id,
      reference: booking.reference,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      amountCents: booking.amountCents,
      items: items.map(({ name, labels }) => ({ name, labels })),
    };
  } catch (error) {
    return { ok: false, ...toFormState(error) };
  }
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
