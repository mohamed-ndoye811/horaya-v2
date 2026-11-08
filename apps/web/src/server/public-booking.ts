/**
 * Pages publiques d'un espace (horaya.app/<adresse>) : données des pages et actions des
 * visiteurs (voir functions/public.ts). Aucune session : tout passe par l'adresse de l'espace
 * et, pour « Gérer ma réservation », par le jeton du lien.
 */
import {
  amountDueOnline,
  awaitsOnlinePayment,
  cancelBookingWithToken,
  createEventBooking,
  getCurrentPlan,
  hasFeature,
  hashToken,
  paidCents,
  refundForCancellation,
  startCheckout,
} from "@horaya/core";
import {
  getManagedBooking,
  getPublicEvent,
  getSeriesOffer,
  listBookingPayments,
  listCalendarLinkEvents,
  listPublicEvents,
  listPublicPassPlans,
  listUsablePasses,
  type ManagedBooking,
  type PublicWorkspace,
} from "@horaya/db";
import { notFound, redirect } from "@tanstack/react-router";
import { rawFieldValues } from "@/lib/fields";
import { bookingState } from "@/lib/public-booking";
import { withParams } from "@/lib/search-params";
import { sendBookingCreatedEmail } from "./booking-emails";
import { currentCustomerAccount } from "./customer-space";
import { db } from "./db";
import { managedEnrollment } from "./enrollments";
import { type FormState, toFormState } from "./form-state";
import { absoluteUrl } from "./mailer";
import { currentCustomerIdentity, payWithMyPassImpl } from "./passes";
import { paymentDeps } from "./payments";
import { getCalendarLink, getWorkspaceBySlug, workspacePaymentChannel } from "./public";
import { clientIp, rateLimited } from "./rate-limit";
import { deps } from "./services";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/** Mise en page publique : l'espace, ou introuvable. */
export async function publicWorkspace(slug: string) {
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) throw notFound();
  return workspace;
}

/** Cadre des pages publiques : l'espace, et le logo Horaya au pied sauf en marque blanche. */
export async function publicLayout(slug: string) {
  const workspace = await publicWorkspace(slug);
  const { plan } = await getCurrentPlan(deps, workspace.id);
  return { ...workspace, whiteLabel: hasFeature(plan, "whiteLabel") };
}

/* ---------- Données des pages ---------- */

/** Maquette 5.1 : les événements à venir de l'espace. */
export async function publicHome(slug: string) {
  const workspace = await publicWorkspace(slug);
  const now = new Date();
  const [events, passPlans] = await Promise.all([
    listPublicEvents(db, workspace.id, now),
    listPublicPassPlans(db, workspace.id),
  ]);
  return { workspace, events, now, hasPassPlans: passPlans.length > 0 };
}

/** Lien calendrier : les événements choisis par l'équipe, « sur invitation » compris. */
export async function calendarLinkPage(slug: string, lien: string) {
  const workspace = await publicWorkspace(slug);
  const link = await getCalendarLink(workspace.id, lien);
  const now = new Date();
  return {
    workspace,
    link: link ? { slug: link.slug, name: link.name } : null,
    events: link ? await listCalendarLinkEvents(db, link, now) : [],
    now,
  };
}

/**
 * Maquette 5.2 : un événement public (arrivé par un lien calendrier, il peut être « sur
 * invitation »).
 */
export async function publicEventPage(slug: string, eventSlug: string, lien: string | undefined) {
  const workspace = await publicWorkspace(slug);
  const link = await getCalendarLink(workspace.id, lien);
  const event = await getPublicEvent(db, workspace.id, eventSlug, link);
  const now = new Date();
  // Cours à l'année : l'inscription à toute la série, s'il reste des séances publiques.
  const offer =
    event?.seriesId && event.enrollmentEnabled
      ? await getSeriesOffer(db, workspace.id, event.seriesId, now)
      : null;
  return {
    workspace,
    linkSlug: link?.slug ?? null,
    event,
    channel: event
      ? workspacePaymentChannel(workspace, event.paymentMode, event.paymentLinkUrl)
      : null,
    offer:
      offer &&
      offer.enrollmentPriceCents !== null &&
      offer.sessions.length > 0 &&
      offer.sessions.every((session) => session.visibility === "public")
        ? offer
        : null,
    now,
  };
}

/** Maquette 5.3 : réservation ; complet ou clos, retour à la page de l'événement. */
export async function bookEventPage(
  slug: string,
  eventSlug: string,
  lien: string | undefined,
  places: string | undefined,
) {
  const data = await publicEventPage(slug, eventSlug, lien);
  if (!data.event) return { ...data, seats: 1, prefill: null, pass: null };
  const state = bookingState(data.event, data.now);
  const dropInClosed = data.event.enrollmentEnabled && !data.event.dropInAllowed;
  if (state.kind === "full" || state.kind === "closed" || dropInClosed) {
    throw redirect({
      href: withParams(`/${slug}/${eventSlug}`, { lien: data.linkSlug ?? undefined }),
    });
  }
  const requested = Number(places ?? 1);
  const seats = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), state.maxSeats) : 1;
  // Lot 31 : client connecté avec une carte acceptée ici et assez de séances pour ses places.
  const identity =
    data.event.priceCents > 0 ? await currentCustomerIdentity(data.workspace.id) : null;
  const passes = identity
    ? await listUsablePasses(
        db,
        data.workspace.id,
        identity.customerId,
        data.event.typeId,
        data.now,
      )
    : [];
  const pass = passes.find((entry) => entry.balance >= seats);
  return {
    ...data,
    seats,
    prefill: await customerPrefill(),
    pass: pass ? { id: pass.id, name: pass.name, balance: pass.balance } : null,
  };
}

/** Espace client connecté : son profil préremplit le participant 1 (réservation, inscription). */
export async function customerPrefill() {
  const account = await currentCustomerAccount();
  return (
    account && {
      firstName: account.firstName ?? "",
      lastName: account.lastName ?? "",
      email: account.email,
      phone: account.phone ?? "",
    }
  );
}

/** Maquette 5.4 : la réservation du lien, avec ce qui a été payé et ce qui serait remboursé. */
export async function managedBookingPage(slug: string, token: string) {
  const workspace = await publicWorkspace(slug);
  const booking = await getManagedBooking(db, workspace.id, await hashToken(token));
  const now = new Date();
  if (!booking) {
    // Même adresse pour le lien de gestion d'une inscription à une série.
    return {
      workspace,
      booking: null,
      enrollment: await managedEnrollment(workspace, token, now),
      now,
    } as const;
  }
  return {
    workspace,
    booking,
    enrollment: null,
    now,
    ...(await bookingMoney(workspace, booking, now)),
  };
}

/**
 * Argent d'une réservation vue par le client (« Gérer ma réservation », espace client) : moyen
 * de paiement, payé, remboursé, reste dû en ligne, remboursement en cas d'annulation.
 */
export async function bookingMoney(workspace: PublicWorkspace, booking: ManagedBooking, now: Date) {
  const payments = await listBookingPayments(db, booking.id);
  const paid = paidCents(payments);
  const channel = workspacePaymentChannel(
    workspace,
    booking.paymentMode,
    booking.eventPaymentLinkUrl,
  );
  return {
    channel,
    paid,
    refunded: payments
      .filter((entry) => entry.kind === "refund" && entry.status === "succeeded")
      .reduce((total, entry) => total + entry.amountCents, 0),
    awaitsPayment: channel !== null && awaitsOnlinePayment(booking, paid),
    due: amountDueOnline(booking, paid),
    refund:
      paid > 0
        ? refundForCancellation({
            paidCents: paid,
            cancelledBy: "customer",
            startsAt: booking.eventStartsAt ?? booking.rentalStartsAt,
            now,
            policy: workspace,
          })
        : null,
  };
}

/* ---------- Actions ---------- */

/** Étape 2 (écran 18) : coordonnées des participants, puis réservation au nom du client. */
export async function createPublicBooking(
  slug: string,
  eventSlug: string,
  linkSlug: string | null,
  seats: number,
  form: FormData,
): Promise<FormState> {
  const workspace = await getWorkspaceBySlug(slug);
  const link = workspace ? await getCalendarLink(workspace.id, linkSlug ?? undefined) : null;
  const event = workspace ? await getPublicEvent(db, workspace.id, eventSlug, link) : null;
  if (!workspace || !event) return { error: "Cet événement n'est plus disponible." };
  const blocked = await rateLimited(`booking:ip:${await clientIp()}`, 20, 3600);
  if (blocked) return { error: blocked };

  const fieldErrors: Record<string, string> = {};
  const customer = {
    firstName: text(form, "firstName"),
    lastName: text(form, "lastName"),
    email: text(form, "email"),
    phone: text(form, "phone") || null,
    company: text(form, "company") || null,
  };
  // Une ligne par place : la première, c'est la personne qui réserve. Le core valide les réponses.
  const participants = Array.from({ length: seats }, (_, index) => ({
    firstName: index === 0 ? customer.firstName : text(form, `p${index}.firstName`),
    lastName: index === 0 ? customer.lastName : text(form, `p${index}.lastName`),
    email: index === 0 ? customer.email : null,
    answers: rawFieldValues(form, `p${index}.`),
  }));
  if (form.get("terms") !== "on") fieldErrors.terms = "Accepte les conditions pour réserver";
  if (Object.keys(fieldErrors).length > 0)
    return { error: "Vérifie les champs en rouge.", fieldErrors };
  // Anti-force brute : chaque saisie de code compte, qu'il soit bon ou non.
  const giftCardCode = text(form, "giftCardCode");
  if (giftCardCode) {
    const tooMany = await rateLimited(`giftcode:ip:${await clientIp()}`, 10, 900);
    if (tooMany) return { error: tooMany, fieldErrors: { giftCardCode: tooMany } };
  }

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
        answers: rawFieldValues(form, "a."),
        participants,
        customerMessage: text(form, "customerMessage") || null,
        // Le core revérifie que le lien est actif et contient l'événement.
        calendarLinkSlug: link?.slug ?? null,
        giftCardCode: giftCardCode || null,
      },
    );
    manageToken = created.manageToken;
    // « Payer avec ma carte » coché (client connecté) : réglée avant l'e-mail de confirmation.
    // Si la carte ne passe plus (solde, liste d'attente…), la réservation reste à payer.
    // Un bon cadeau déjà déduit l'emporte : la carte réglerait le prix entier une seconde fois.
    const passId = giftCardCode ? "" : text(form, "passId");
    const paidWithPass =
      passId !== "" && !(await payWithMyPassImpl(slug, created.booking.id, passId)).error;
    await sendBookingCreatedEmail(workspace.id, created.booking.id, manageToken);
    next = `/${slug}/reservation/${manageToken}?nouvelle=1`;
    // Paiement intégré (tout ou l'acompte) : direction la page de paiement sécurisée.
    // Avec un lien externe, la page de confirmation propose le bouton « Payer ».
    if (
      workspacePaymentChannel(workspace, event.paymentMode, event.paymentLinkUrl)?.kind ===
        "stripe" &&
      !paidWithPass &&
      awaitsOnlinePayment(created.booking, created.giftCardCents)
    ) {
      next = await checkoutUrl(
        `/${slug}/reservation/${manageToken}?nouvelle=1`,
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
  throw redirect({ href: next });
}

/** Page de paiement sécurisée ; au retour, le client revient sur `returnPath` (?paiement=…). */
export async function checkoutUrl(
  returnPath: string,
  organizationId: string,
  bookingId: string,
  title: string,
  seats: number,
): Promise<string> {
  const deps = paymentDeps;
  if (!deps) throw new Error("Paiement intégré désactivé");
  const back = (query: string) =>
    absoluteUrl(`${returnPath}${returnPath.includes("?") ? "&" : "?"}${query}`);
  const { url } = await startCheckout(deps, organizationId, bookingId, {
    description: `${title} · ${seats} place${seats > 1 ? "s" : ""}`,
    successUrl: back("paiement=ok"),
    cancelUrl: back("paiement=annule"),
  });
  return url;
}

/** « Payer » depuis « Gérer ma réservation » : reprend un paiement abandonné. */
export async function payManagedBooking(slug: string, token: string): Promise<FormState> {
  const workspace = await getWorkspaceBySlug(slug);
  const booking = workspace
    ? await getManagedBooking(db, workspace.id, await hashToken(token))
    : null;
  if (!workspace || !booking) return { error: "Lien invalide." };
  let url: string;
  try {
    url = await checkoutUrl(
      `/${slug}/reservation/${token}?nouvelle=1`,
      workspace.id,
      booking.id,
      booking.eventTitle ?? "Location",
      booking.seats,
    );
  } catch (error) {
    return toFormState(error);
  }
  throw redirect({ href: url });
}

/** « Gérer ma réservation » : annulation par le client, jusqu'au début de l'événement. */
export async function cancelManagedBooking(slug: string, token: string): Promise<FormState> {
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) return { error: "Espace introuvable." };
  try {
    await cancelBookingWithToken(deps, workspace.id, token);
  } catch (error) {
    return toFormState(error);
  }
  return { success: "Réservation annulée. Un e-mail de confirmation est parti." };
}

/** « Rien reçu ? » : renvoie l'e-mail de la réservation avec le même lien. */
export async function resendBookingEmail(slug: string, token: string): Promise<FormState> {
  const workspace = await getWorkspaceBySlug(slug);
  const booking = workspace
    ? await getManagedBooking(db, workspace.id, await hashToken(token))
    : null;
  if (!workspace || !booking) return { error: "Lien invalide." };
  const blocked = await rateLimited(`resend:${booking.id}`, 3, 3600);
  if (blocked) return { error: blocked };
  await sendBookingCreatedEmail(workspace.id, booking.id, token);
  return { success: "E-mail renvoyé." };
}
