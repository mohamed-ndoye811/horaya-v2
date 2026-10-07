"use server";

import {
  awaitsOnlinePayment,
  cancelBookingWithToken,
  createEventBooking,
  hashToken,
  reissueManageLinks,
  startCheckout,
} from "@horaya/core";
import { getManagedBooking, getPublicEvent } from "@horaya/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendBookingCreatedEmail, sendBookingLinkEmail } from "@/server/booking-emails";
import { db } from "@/server/db";
import { type FormState, toFormState } from "@/server/form-state";
import { absoluteUrl } from "@/server/mailer";
import { paymentDeps } from "@/server/payments";
import { getWorkspaceBySlug } from "@/server/public";
import { deps } from "@/server/services";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/** Étape 2 (écran 18) : coordonnées des participants, puis réservation au nom du client. */
export async function createPublicBookingAction(
  slug: string,
  eventSlug: string,
  seats: number,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const workspace = await getWorkspaceBySlug(slug);
  const event = workspace ? await getPublicEvent(db, workspace.id, eventSlug) : null;
  if (!workspace || !event) return { error: "Cet événement n'est plus disponible." };

  const fieldErrors: Record<string, string> = {};
  const answers = (index: number) =>
    Object.fromEntries(
      event.customFields.map((field) => {
        const raw = form.get(`p${index}.${field.key}`);
        const value = field.type === "checkbox" ? raw === "on" : String(raw ?? "").trim();
        if (index === 0 && field.required && (value === "" || value === false)) {
          fieldErrors[`p0.${field.key}`] = "Champ requis";
        }
        return [field.key, value];
      }),
    );
  const customer = {
    firstName: text(form, "firstName"),
    lastName: text(form, "lastName"),
    email: text(form, "email"),
    phone: text(form, "phone") || null,
    company: text(form, "company") || null,
  };
  const participants = [
    {
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      customAnswers: answers(0),
    },
  ];
  for (let index = 1; index < seats; index++) {
    const firstName = text(form, `p${index}.firstName`);
    const lastName = text(form, `p${index}.lastName`);
    // Les autres participants sont facultatifs : on peut réserver sans connaître leurs noms.
    if (firstName || lastName) {
      if (!firstName) fieldErrors[`p${index}.firstName`] = "Prénom requis";
      if (!lastName) fieldErrors[`p${index}.lastName`] = "Nom requis";
      participants.push({ firstName, lastName, email: "", customAnswers: answers(index) });
    }
  }
  if (form.get("terms") !== "on") fieldErrors.terms = "Accepte les conditions pour réserver";
  if (Object.keys(fieldErrors).length > 0)
    return { error: "Vérifie les champs en rouge.", fieldErrors };

  let manageToken: string;
  let next: string;
  try {
    const created = await createEventBooking(
      deps,
      { type: "customer", organizationId: workspace.id },
      {
        eventId: event.id,
        seats,
        customer,
        participants: participants.map((participant) => ({
          ...participant,
          email: participant.email || null,
        })),
        customerMessage: text(form, "customerMessage") || null,
      },
    );
    manageToken = created.manageToken;
    await sendBookingCreatedEmail(workspace.id, created.booking.id, manageToken);
    next = `/${slug}/reservation/${manageToken}?nouvelle=1`;
    // Paiement en ligne (tout ou l'acompte) : direction la page de paiement sécurisée.
    if (workspace.onlinePayments && awaitsOnlinePayment(created.booking)) {
      next = await checkoutUrl(
        slug,
        manageToken,
        workspace.id,
        created.booking.id,
        event.title,
        seats,
      ).catch((error) => {
        console.error("Page de paiement indisponible", error);
        return next;
      });
    }
  } catch (error) {
    return toFormState(error);
  }
  redirect(next);
}

async function checkoutUrl(
  slug: string,
  token: string,
  organizationId: string,
  bookingId: string,
  title: string,
  seats: number,
): Promise<string> {
  const { url } = await startCheckout(paymentDeps, organizationId, bookingId, {
    description: `${title} · ${seats} place${seats > 1 ? "s" : ""}`,
    successUrl: absoluteUrl(`/${slug}/reservation/${token}?nouvelle=1&paiement=ok`),
    cancelUrl: absoluteUrl(`/${slug}/reservation/${token}?paiement=annule`),
  });
  return url;
}

/** « Payer » depuis « Gérer ma réservation » : reprend un paiement abandonné. */
export async function payManagedBookingAction(slug: string, token: string): Promise<FormState> {
  const workspace = await getWorkspaceBySlug(slug);
  const booking = workspace
    ? await getManagedBooking(db, workspace.id, await hashToken(token))
    : null;
  if (!workspace || !booking) return { error: "Lien invalide." };
  let url: string;
  try {
    url = await checkoutUrl(
      slug,
      token,
      workspace.id,
      booking.id,
      booking.eventTitle ?? "Location",
      booking.seats,
    );
  } catch (error) {
    return toFormState(error);
  }
  redirect(url);
}

/** « Gérer ma réservation » : annulation par le client, jusqu'au début de l'événement. */
export async function cancelManagedBookingAction(slug: string, token: string): Promise<FormState> {
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) return { error: "Espace introuvable." };
  try {
    await cancelBookingWithToken(deps, workspace.id, token);
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(`/${slug}/reservation/${token}`);
  return { success: "Réservation annulée. Un e-mail de confirmation est parti." };
}

/** « Rien reçu ? » : renvoie l'e-mail de la réservation avec le même lien. */
export async function resendBookingEmailAction(slug: string, token: string): Promise<FormState> {
  const workspace = await getWorkspaceBySlug(slug);
  const booking = workspace
    ? await getManagedBooking(db, workspace.id, await hashToken(token))
    : null;
  if (!workspace || !booking) return { error: "Lien invalide." };
  await sendBookingCreatedEmail(workspace.id, booking.id, token);
  return { success: "E-mail renvoyé." };
}

/** « Mes réservations » : un lien neuf par réservation à venir, sans dire si l'adresse est connue. */
export async function requestBookingLinksAction(
  slug: string,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) return { error: "Espace introuvable." };
  const email = text(form, "email");
  try {
    const links = await reissueManageLinks(deps, workspace.id, email);
    await Promise.all(
      links.map(({ booking, manageToken }) =>
        sendBookingLinkEmail(workspace.id, booking.id, manageToken),
      ),
    );
  } catch (error) {
    return toFormState(error);
  }
  return {
    success: `Si des réservations à venir existent pour ${email.toLowerCase()}, tu vas recevoir un e-mail par réservation avec son lien.`,
  };
}
