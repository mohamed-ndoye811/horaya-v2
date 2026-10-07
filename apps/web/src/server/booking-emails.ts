import {
  type ActivityEntry,
  amountDueOnline,
  awaitsOnlinePayment,
  type NotificationType,
} from "@horaya/core";
import {
  getBookingDetail,
  getWorkspaceSettings,
  listNotificationRecipients,
  tenantSettingsReader,
} from "@horaya/db";
import {
  type BookingMail,
  bookingAwaitingPaymentEmail,
  bookingCancelledEmail,
  bookingConfirmedEmail,
  bookingLinkEmail,
  bookingPaymentReceivedEmail,
  bookingPendingEmail,
  bookingPromotedEmail,
  bookingRefundedEmail,
  bookingRefusedEmail,
  bookingWaitlistedEmail,
  type EmailContent,
  teamBookingEmail,
} from "@horaya/mail";
import { textOn } from "@/lib/colors";
import { formatEventRange, formatMoney } from "@/lib/format";
import { paymentChannel } from "@/lib/payment-channel";
import { db } from "./db";
import { absoluteUrl, mailer } from "./mailer";
import { integratedPaymentsEnabled } from "./payments/config";

/**
 * E-mails liés aux réservations : aux participants (au nom de l'espace) et à l'équipe
 * (selon les préférences de notification de chaque membre).
 */

const STATUS_LABELS: Record<string, string> = {
  pending: "à valider",
  confirmed: "confirmée",
  waitlisted: "liste d'attente",
};

export const manageUrl = (slug: string, token: string) =>
  absoluteUrl(`/${slug}/reservation/${token}`);

async function loadBooking(organizationId: string, bookingId: string) {
  const [detail, workspace, settings] = await Promise.all([
    getBookingDetail(db, organizationId, bookingId),
    getWorkspaceSettings(db, organizationId),
    tenantSettingsReader(db).get(organizationId),
  ]);
  if (!detail || !workspace) return null;
  const { booking } = detail;
  const startsAt = booking.event?.startsAt ?? booking.rentalStartsAt;
  const endsAt = booking.event?.endsAt ?? booking.rentalEndsAt;
  const title =
    booking.event?.title ??
    `Location · ${detail.rentalItems.map((entry) => entry.name).join(", ")}`;
  const channel = paymentChannel({
    paymentMode: booking.paymentMode,
    stripeReady: integratedPaymentsEnabled && workspace.stripeAccountStatus === "active",
    eventLink: booking.event?.paymentLinkUrl ?? null,
    workspaceLink: workspace.paymentLinkUrl ?? null,
  });
  const onlinePayments = channel !== null;
  const paymentNote =
    booking.paymentMode === "on_site"
      ? "à régler sur place"
      : booking.paymentStatus === "paid"
        ? booking.paymentMode === "deposit"
          ? `acompte de ${formatMoney(booking.depositCents ?? 0)} payé, le reste sur place`
          : "payé en ligne"
        : onlinePayments
          ? "à payer en ligne"
          : "à régler auprès de l'organisateur";
  const amount =
    booking.amountCents > 0 ? `${formatMoney(booking.amountCents)} · ${paymentNote}` : null;
  const mail = (url: string): BookingMail => ({
    workspace: {
      name: workspace.name,
      color: workspace.brandColor,
      textColor: textOn(workspace.brandColor),
    },
    firstName: booking.customer.firstName,
    title,
    reference: booking.reference,
    when: startsAt && endsAt ? formatEventRange(startsAt, endsAt, settings.timezone) : "",
    where: booking.event?.locationName ?? null,
    seats: booking.seats,
    amount,
    manageUrl: url,
  });
  return {
    booking,
    workspace,
    title,
    mail,
    onlinePayments,
    channel,
    eventsUrl: absoluteUrl(`/${workspace.slug}`),
    // Sans jeton (stocké haché), on renvoie vers « Mes réservations » qui en génère un neuf.
    linkRequestUrl: absoluteUrl(
      `/${workspace.slug}/mes-reservations?email=${encodeURIComponent(booking.customer.email)}`,
    ),
  };
}

async function send(to: string, content: EmailContent) {
  try {
    await mailer.send(to, content);
  } catch (error) {
    console.error("E-mail non envoyé", to, content.subject, error);
  }
}

/** Juste après une réservation (page publique ou équipe) : le seul moment où l'on a le jeton en clair. */
export async function sendBookingCreatedEmail(
  organizationId: string,
  bookingId: string,
  manageToken: string,
) {
  const loaded = await loadBooking(organizationId, bookingId);
  if (!loaded || !["pending", "confirmed", "waitlisted"].includes(loaded.booking.status)) return;
  const mail = loaded.mail(manageUrl(loaded.workspace.slug, manageToken));
  if (loaded.channel && awaitsOnlinePayment(loaded.booking)) {
    await send(
      loaded.booking.customer.email,
      bookingAwaitingPaymentEmail({
        ...mail,
        due: formatMoney(amountDueOnline(loaded.booking)),
        ...(loaded.channel.kind === "stripe"
          ? { reason: "checkout" as const, payUrl: mail.manageUrl, minutes: 30 }
          : { reason: "link" as const, payUrl: loaded.channel.url }),
      }),
    );
    return;
  }
  const template =
    loaded.booking.status === "pending"
      ? bookingPendingEmail
      : loaded.booking.status === "waitlisted"
        ? bookingWaitlistedEmail
        : bookingConfirmedEmail;
  await send(loaded.booking.customer.email, template(mail));
}

/** « Mes réservations » : un lien neuf par réservation à venir. */
export async function sendBookingLinkEmail(
  organizationId: string,
  bookingId: string,
  manageToken: string,
) {
  const loaded = await loadBooking(organizationId, bookingId);
  if (!loaded) return;
  await send(
    loaded.booking.customer.email,
    bookingLinkEmail(loaded.mail(manageUrl(loaded.workspace.slug, manageToken))),
  );
}

async function notifyTeam(organizationId: string, type: NotificationType, content: EmailContent) {
  const recipients = await listNotificationRecipients(db, organizationId, type);
  await Promise.all(recipients.map((email) => send(email, content)));
}

/** Branché sur la fin des transactions (createDeps) : chaque changement de statut prévient qui de droit. */
export async function notifyFromActivity(entries: ActivityEntry[]) {
  for (const entry of entries) {
    if (entry.entityType !== "booking") continue;
    const loaded = await loadBooking(entry.organizationId, entry.entityId);
    if (!loaded) continue;
    const { booking, workspace, mail, eventsUrl, linkRequestUrl, title } = loaded;
    const to = booking.customer.email;
    const customerName = `${booking.customer.firstName} ${booking.customer.lastName}`;
    const adminUrl = absoluteUrl(`/app/reservations/${booking.id}`);
    const reason = typeof entry.data?.reason === "string" ? entry.data.reason : null;

    switch (entry.action) {
      case "booking.created":
        // Le client reçoit son e-mail (avec son lien) de l'appelant ; ici, l'équipe seulement.
        if (entry.actorType === "customer") {
          await notifyTeam(
            entry.organizationId,
            "booking_created",
            teamBookingEmail({
              workspaceName: workspace.name,
              kind: "created",
              customerName,
              title,
              seats: booking.seats,
              status: STATUS_LABELS[booking.status] ?? booking.status,
              url: adminUrl,
            }),
          );
        }
        break;
      case "booking.paid": {
        const paid = Number(entry.data?.amountCents ?? 0);
        const remaining = booking.paymentMode === "deposit" ? booking.amountCents - paid : 0;
        await send(
          to,
          bookingPaymentReceivedEmail({
            ...mail(linkRequestUrl),
            paid: formatMoney(paid),
            remaining: remaining > 0 ? formatMoney(remaining) : null,
          }),
        );
        await notifyTeam(
          entry.organizationId,
          "payment_received",
          teamBookingEmail({
            workspaceName: workspace.name,
            kind: "paid",
            customerName,
            title,
            seats: booking.seats,
            status: formatMoney(paid),
            url: adminUrl,
          }),
        );
        break;
      }
      case "booking.refunded":
        await send(
          to,
          bookingRefundedEmail({
            ...mail(linkRequestUrl),
            refunded: formatMoney(Number(entry.data?.amountCents ?? 0)),
            manual: entry.data?.manual === true,
          }),
        );
        break;
      case "booking.confirmed":
        // Validée, mais le paiement en ligne reste à faire : on l'annonce plutôt qu'un « C'est réservé ».
        if (loaded.channel && awaitsOnlinePayment(booking)) {
          await send(
            to,
            bookingAwaitingPaymentEmail({
              ...mail(linkRequestUrl),
              due: formatMoney(amountDueOnline(booking)),
              ...(loaded.channel.kind === "stripe"
                ? { reason: "validated" as const, payUrl: linkRequestUrl }
                : { reason: "link" as const, payUrl: loaded.channel.url }),
            }),
          );
        } else {
          await send(to, bookingConfirmedEmail(mail(linkRequestUrl)));
        }
        break;
      case "booking.refused":
        await send(to, bookingRefusedEmail({ ...mail(linkRequestUrl), reason, eventsUrl }));
        break;
      case "booking.promoted":
        await send(
          to,
          bookingPromotedEmail({
            ...mail(linkRequestUrl),
            confirmed: entry.data?.status === "confirmed",
          }),
        );
        break;
      case "booking.cancelled": {
        const byCustomer = entry.actorType === "customer";
        await send(
          to,
          bookingCancelledEmail({
            ...mail(linkRequestUrl),
            byCustomer,
            reason:
              reason === "customer_request"
                ? null
                : reason === "payment_expired"
                  ? "paiement en ligne non finalisé dans les 30 minutes"
                  : reason,
            eventsUrl,
          }),
        );
        if (byCustomer) {
          await notifyTeam(
            entry.organizationId,
            "booking_cancelled",
            teamBookingEmail({
              workspaceName: workspace.name,
              kind: "cancelled",
              customerName,
              title,
              seats: booking.seats,
              status: "annulée",
              url: adminUrl,
            }),
          );
        }
        break;
      }
    }
  }
}
