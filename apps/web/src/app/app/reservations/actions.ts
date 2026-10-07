"use server";

import { cancelBooking, confirmBooking, createEventBooking, refuseBooking } from "@horaya/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type FormState, toFormState } from "@/server/form-state";
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
    const { booking } = await createEventBooking(deps, actor, {
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
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath("/app", "layout");
  redirect(`/app/reservations/${bookingId}`);
}
