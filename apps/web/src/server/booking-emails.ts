import {
  type ActivityEntry,
  amountDueOnline,
  awaitsOnlinePayment,
  type NotificationType,
  paidCents,
} from "@horaya/core";
import {
  claimAlmostFull,
  createNotifications,
  getBookingDetail,
  getEnrollment,
  getPassForEmail,
  getWeeklyDigest,
  getWorkspaceSettings,
  listBookingPayments,
  listNotificationRecipients,
  tenantSettingsReader,
} from "@horaya/db";
import {
  type BookingMail,
  bookingAwaitingPaymentEmail,
  bookingCancelledEmail,
  bookingConfirmedEmail,
  bookingFollowUpEmail,
  bookingPaymentReceivedEmail,
  bookingPendingEmail,
  bookingPromotedEmail,
  bookingRefundedEmail,
  bookingRefusedEmail,
  bookingReminderEmail,
  bookingRescheduledEmail,
  bookingSoonEmail,
  bookingWaitlistedEmail,
  type EmailContent,
  enrollmentConfirmedEmail,
  passActivatedEmail,
  teamAlmostFullEmail,
  teamBookingEmail,
  teamMinimumCancelledEmail,
  teamMinimumRiskEmail,
  teamReminderEmail,
  weeklyDigestEmail,
} from "@horaya/mail";
import { textOn } from "@/lib/colors";
import { enrollmentPayment } from "@/lib/enrollment";
import { answerGroups } from "@/lib/fields";
import {
  formatDateTimeShort,
  formatDayNumber,
  formatEventRange,
  formatHour,
  formatMoney,
  formatMonthShort,
  formatWeekdayShort,
} from "@/lib/format";
import { paymentChannel } from "@/lib/payment-channel";
import { withParams } from "@/lib/search-params";
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
  const [detail, workspace, settings, payments] = await Promise.all([
    getBookingDetail(db, organizationId, bookingId),
    getWorkspaceSettings(db, organizationId),
    tenantSettingsReader(db).get(organizationId),
    listBookingPayments(db, bookingId),
  ]);
  if (!detail || !workspace) return null;
  const { booking } = detail;
  // Déjà réglé (bon cadeau, paiement noté) : le lien de paiement ne réclame que le reste.
  const paid = paidCents(payments);
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
      : booking.paymentStatus === "paid_with_pass"
        ? "payée avec ta carte"
        : booking.paymentStatus === "paid"
          ? payments.some((entry) => entry.method === "gift_card" && entry.kind === "charge")
            ? "réglé avec un bon cadeau"
            : booking.paymentMode === "deposit"
              ? `acompte de ${formatMoney(booking.depositCents ?? 0)} payé, le reste sur place`
              : "payé en ligne"
          : onlinePayments
            ? "à payer en ligne"
            : "à régler auprès de l'organisateur";
  const amount =
    booking.amountCents > 0 ? `${formatMoney(booking.amountCents)} · ${paymentNote}` : null;
  // Récapitulatif des réponses du client : jamais les champs de description (internes compris).
  const answers = answerGroups(
    {
      fields: booking.event?.fields ?? [],
      answers: booking.answers,
      participants: detail.participants,
    },
    settings.timezone,
  ).flatMap((group) =>
    group.rows.map((row): [string, string] => [
      group.title ? `${group.title} · ${row.label}` : row.label,
      row.value,
    ]),
  );
  const mail = (url: string): BookingMail => ({
    workspace: {
      name: workspace.name,
      color: workspace.brandColor,
      textColor: textOn(workspace.brandColor),
      logo: workspace.logo ? absoluteUrl(workspace.logo) : null,
    },
    firstName: booking.customer.firstName,
    title,
    reference: booking.reference,
    when: startsAt && endsAt ? formatEventRange(startsAt, endsAt, settings.timezone) : "",
    where:
      [booking.event?.locationName, booking.event?.locationAddress].filter(Boolean).join(", ") ||
      null,
    onlineUrl: booking.event?.onlineUrl ?? null,
    equipment: detail.equipment,
    seats: booking.seats,
    amount,
    manageUrl: url,
    // Modules copiés sur l'événement : messages et documents joints (liens absolus).
    note: booking.event?.modules.messages?.confirmation ?? null,
    bring: booking.event?.modules.messages?.bring ?? null,
    documents: (booking.event?.modules.documents?.files ?? []).map((file) => ({
      name: file.name,
      url: absoluteUrl(file.url),
    })),
  });
  return {
    booking,
    paid,
    workspace,
    title,
    mail,
    answers,
    onlinePayments,
    channel,
    eventsUrl: absoluteUrl(`/${workspace.slug}`),
    // Sans jeton (stocké haché), on renvoie vers la connexion à l'espace client.
    linkRequestUrl: absoluteUrl(
      withParams(`/${workspace.slug}/mon-espace/connexion`, {
        email: booking.customer.email ?? undefined,
      }),
    ),
  };
}

/** Un client saisi au comptoir peut n'avoir pas d'e-mail : rien à envoyer. */
async function send(to: string | null, content: EmailContent) {
  if (!to) return;
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
  const mail = {
    ...loaded.mail(manageUrl(loaded.workspace.slug, manageToken)),
    answers: loaded.answers,
  };
  if (loaded.channel && awaitsOnlinePayment(loaded.booking, loaded.paid)) {
    await send(
      loaded.booking.customer.email,
      bookingAwaitingPaymentEmail({
        ...mail,
        due: formatMoney(amountDueOnline(loaded.booking, loaded.paid)),
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

/** Inscription à une série : récapitulatif des séances et lien de gestion (jeton en clair). */
export async function sendEnrollmentEmail(
  organizationId: string,
  enrollmentId: string,
  manageToken: string,
) {
  const [enrollment, workspace, settings] = await Promise.all([
    getEnrollment(db, organizationId, { id: enrollmentId }),
    getWorkspaceSettings(db, organizationId),
    tenantSettingsReader(db).get(organizationId),
  ]);
  const first = enrollment?.sessions[0];
  if (!enrollment || !workspace || !first) return;
  const payment = enrollmentPayment(enrollment, workspace.paymentLinkUrl ?? null);
  await send(
    enrollment.customerEmail,
    enrollmentConfirmedEmail({
      workspace: {
        name: workspace.name,
        color: workspace.brandColor,
        textColor: textOn(workspace.brandColor),
        logo: workspace.logo ? absoluteUrl(workspace.logo) : null,
      },
      firstName: enrollment.customerFirstName,
      title: first.title,
      sessions: enrollment.sessions.map((session) =>
        formatDateTimeShort(session.startsAt, settings.timezone),
      ),
      where: first.locationName,
      amount: payment
        ? `${formatMoney(enrollment.amountCents)} · ${payment.label.toLowerCase()}`
        : null,
      payUrl: payment?.payUrl ?? null,
      manageUrl: manageUrl(workspace.slug, manageToken),
    }),
  );
}

/** Nouvelle inscription en ligne à une série : l'équipe est prévenue une fois (pas par séance). */
async function notifyEnrollmentCreated(entry: ActivityEntry) {
  if (entry.action !== "enrollment.created" || entry.actorType !== "customer") return;
  const [enrollment, workspace] = await Promise.all([
    getEnrollment(db, entry.organizationId, { id: entry.entityId }),
    getWorkspaceSettings(db, entry.organizationId),
  ]);
  const first = enrollment?.sessions[0];
  if (!enrollment || !workspace || !first) return;
  const customerName = `${enrollment.customerFirstName} ${enrollment.customerLastName}`;
  const link = `/app/evenements/${first.eventId}?onglet=serie`;
  const summary = `${customerName} · ${first.title} · ${enrollment.sessions.length} séances`;
  await notifyTeam(
    entry.organizationId,
    "booking_created",
    teamBookingEmail({
      workspaceName: workspace.name,
      kind: "created",
      customerName,
      title: first.title,
      seats: 1,
      status: `inscription à ${enrollment.sessions.length} séances`,
      url: absoluteUrl(link),
    }),
    { title: "Nouvelle inscription à la série", body: summary, link },
  );
}

/**
 * Rappel au client, la veille ou au moment choisi (module Messages) : le lien d'origine n'est
 * pas gardé, on mène à son espace client.
 */
export async function sendBookingReminder(
  organizationId: string,
  bookingId: string,
  custom = false,
) {
  const loaded = await loadBooking(organizationId, bookingId);
  if (!loaded) return;
  const template = custom ? bookingSoonEmail : bookingReminderEmail;
  await send(loaded.booking.customer.email, template(loaded.mail(loaded.linkRequestUrl)));
}

/** Message après la séance (module Messages) : à chaque inscrit confirmé de l'événement. */
export async function sendFollowUp(organizationId: string, bookingId: string) {
  const loaded = await loadBooking(organizationId, bookingId);
  const message = loaded?.booking.event?.modules.messages?.after;
  if (!loaded || !message) return;
  await send(
    loaded.booking.customer.email,
    bookingFollowUpEmail({ ...loaded.mail(loaded.eventsUrl), message }),
  );
}

/** Seuil de maintien : l'équipe est prévenue la veille de J-x, puis de l'annulation. */
export async function notifyMinimum(
  kind: "risk" | "cancelled",
  input: {
    organizationId: string;
    id: string;
    title: string;
    startsAt: Date;
    endsAt: Date;
    timezone: string;
    seats: number;
    minimum: number;
    cancelledBookings?: number;
  },
) {
  const workspace = await getWorkspaceSettings(db, input.organizationId);
  if (!workspace) return;
  const when = formatEventRange(input.startsAt, input.endsAt, input.timezone);
  const link = `/app/evenements/${input.id}`;
  const base = {
    workspaceName: workspace.name,
    title: input.title,
    when,
    seats: input.seats,
    minimum: input.minimum,
    url: absoluteUrl(link),
  };
  if (kind === "risk") {
    await notifyTeam(
      input.organizationId,
      "event_at_risk",
      teamMinimumRiskEmail({ ...base, decision: "demain" }),
      {
        title: `Risque d'annulation : ${input.title}`,
        body: `${when} · ${input.seats} inscrit${input.seats > 1 ? "s" : ""} sur ${input.minimum} nécessaires, décision demain`,
        link,
      },
    );
    return;
  }
  await notifyTeam(
    input.organizationId,
    "event_auto_cancelled",
    teamMinimumCancelledEmail({ ...base, cancelledBookings: input.cancelledBookings ?? 0 }),
    {
      title: `Annulé faute d'inscrits : ${input.title}`,
      body: `${when} · ${input.seats} inscrit${input.seats > 1 ? "s" : ""} sur ${input.minimum}`,
      link,
    },
  );
}

/** Rappel la veille à l'équipe, selon la préférence « Rappel la veille d'un événement ». */
export async function sendTeamReminder(input: {
  organizationId: string;
  eventId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  capacity: number | null;
  seats: number;
}) {
  const workspace = await getWorkspaceSettings(db, input.organizationId);
  if (!workspace) return;
  const when = formatEventRange(input.startsAt, input.endsAt, input.timezone);
  const link = `/app/evenements/${input.eventId}`;
  const filled = `${input.seats}${input.capacity ? ` / ${input.capacity}` : ""} place${input.seats > 1 ? "s" : ""}`;
  await notifyTeam(
    input.organizationId,
    "event_reminder",
    teamReminderEmail({
      workspaceName: workspace.name,
      title: input.title,
      when,
      seats: input.seats,
      capacity: input.capacity,
      url: absoluteUrl(link),
    }),
    { title: `Demain : ${input.title}`, body: `${when} · ${filled}`, link },
  );
}

/** « Événement presque complet » : une fois par événement, dès 80 % de la jauge prise. */
async function notifyAlmostFull(eventId: string) {
  const event = await claimAlmostFull(db, eventId);
  if (!event?.capacity) return;
  const workspace = await getWorkspaceSettings(db, event.organizationId);
  if (!workspace) return;
  const when = formatEventRange(event.startsAt, event.endsAt, event.timezone);
  const link = `/app/evenements/${event.id}`;
  const full = event.seats >= event.capacity;
  await notifyTeam(
    event.organizationId,
    "event_almost_full",
    teamAlmostFullEmail({
      workspaceName: workspace.name,
      title: event.title,
      when,
      seats: event.seats,
      capacity: event.capacity,
      url: absoluteUrl(link),
    }),
    {
      title: `${full ? "Complet" : "Presque complet"} : ${event.title}`,
      body: `${when} · ${event.seats} / ${event.capacity} places`,
      link,
    },
  );
}

/** Récap hebdomadaire d'un espace (le lundi matin). Rien n'est envoyé pour une semaine vide. */
export async function sendWeeklyDigest(organizationId: string, now = new Date()) {
  const [workspace, digest] = await Promise.all([
    getWorkspaceSettings(db, organizationId),
    getWeeklyDigest(db, organizationId, now),
  ]);
  if (!workspace) return;
  if (!digest.bookings && !digest.cancelled && !digest.pending && !digest.upcoming.length) return;
  const upcoming = digest.upcoming.map((entry) => ({
    day: `${formatWeekdayShort(entry.startsAt, entry.timezone)} ${formatDayNumber(entry.startsAt, entry.timezone)} ${formatMonthShort(entry.startsAt, entry.timezone).toLowerCase()}`,
    text: `${formatHour(entry.startsAt, entry.timezone)} · ${entry.title} · ${entry.seats}${entry.capacity ? ` / ${entry.capacity}` : ""} place${entry.seats > 1 ? "s" : ""}`,
  }));
  const revenue = digest.revenueCents > 0 ? formatMoney(digest.revenueCents) : null;
  await notifyTeam(
    organizationId,
    "weekly_digest",
    weeklyDigestEmail({
      workspaceName: workspace.name,
      bookings: digest.bookings,
      seats: digest.seats,
      cancelled: digest.cancelled,
      pending: digest.pending,
      revenue,
      upcoming,
      url: absoluteUrl("/app"),
    }),
    {
      title: "Ta semaine",
      body: `${digest.bookings} réservation${digest.bookings > 1 ? "s" : ""}, ${upcoming.length} événement${upcoming.length > 1 ? "s" : ""} à venir`,
      link: "/app",
    },
  );
}

/** Prévient l'équipe par e-mail et dans l'app (cloche du notch), selon les préférences de chacun. */
export async function notifyTeam(
  organizationId: string,
  type: NotificationType,
  content: EmailContent,
  inApp: { title: string; body: string; link: string },
  /** Intervenant de l'événement : prévenu des inscriptions de ses événements. */
  staffMemberId?: string | null,
) {
  const recipients = await listNotificationRecipients(db, organizationId, type, staffMemberId);
  await Promise.all(recipients.map((email) => send(email, content)));
  try {
    await createNotifications(db, organizationId, type, inApp, staffMemberId);
  } catch (error) {
    console.error("Notification non enregistrée", type, error);
  }
}

/** Carte payée : e-mail au client avec le solde et la date de fin (si le client a une adresse). */
async function sendPassActivatedEmail(organizationId: string, passId: string) {
  const [pass, workspace, settings] = await Promise.all([
    getPassForEmail(db, organizationId, passId),
    getWorkspaceSettings(db, organizationId),
    tenantSettingsReader(db).get(organizationId),
  ]);
  if (!pass || !workspace || !pass.expiresAt) return;
  await send(
    pass.customerEmail,
    passActivatedEmail({
      workspace: {
        name: workspace.name,
        color: workspace.brandColor,
        textColor: textOn(workspace.brandColor),
        logo: workspace.logo ? absoluteUrl(workspace.logo) : null,
      },
      firstName: pass.customerFirstName,
      name: pass.name,
      sessions: pass.balance,
      expiresOn: new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: settings.timezone,
      }).format(pass.expiresAt),
      eventsUrl: absoluteUrl(`/${workspace.slug}`),
    }),
  );
}

/** Branché sur la fin des transactions (createDeps) : chaque changement de statut prévient qui de droit. */
export async function notifyFromActivity(entries: ActivityEntry[]) {
  for (const entry of entries) {
    if (entry.entityType === "enrollment") await notifyEnrollmentCreated(entry);
    if (entry.entityType === "pass" && entry.action === "pass.activated") {
      await sendPassActivatedEmail(entry.organizationId, entry.entityId);
      continue;
    }
    if (entry.entityType !== "booking") continue;
    const loaded = await loadBooking(entry.organizationId, entry.entityId);
    if (!loaded) continue;
    const { booking, workspace, mail, eventsUrl, linkRequestUrl, title } = loaded;
    const to = booking.customer.email;
    const customerName = `${booking.customer.firstName} ${booking.customer.lastName}`;
    const adminPath = `/app/reservations/${booking.id}`;
    const adminUrl = absoluteUrl(adminPath);
    const summary = `${customerName} · ${title} · ${booking.seats} place${booking.seats > 1 ? "s" : ""}`;
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
              answers: loaded.answers,
            }),
            {
              title:
                booking.status === "pending"
                  ? "Réservation à valider"
                  : booking.status === "waitlisted"
                    ? "Inscription en liste d'attente"
                    : "Nouvelle réservation",
              body: summary,
              link: adminPath,
            },
            booking.event?.staffMemberId,
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
          { title: `Paiement reçu · ${formatMoney(paid)}`, body: summary, link: adminPath },
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
        if (loaded.channel && awaitsOnlinePayment(booking, loaded.paid)) {
          await send(
            to,
            bookingAwaitingPaymentEmail({
              ...mail(linkRequestUrl),
              due: formatMoney(amountDueOnline(booking, loaded.paid)),
              ...(loaded.channel.kind === "stripe"
                ? { reason: "validated" as const, payUrl: linkRequestUrl }
                : { reason: "link" as const, payUrl: loaded.channel.url }),
            }),
          );
        } else {
          await send(
            to,
            bookingConfirmedEmail({ ...mail(linkRequestUrl), answers: loaded.answers }),
          );
        }
        break;
      case "booking.refused":
        await send(to, bookingRefusedEmail({ ...mail(linkRequestUrl), reason, eventsUrl }));
        break;
      case "booking.rescheduled": {
        // Date plus chère : la différence est à payer (même lien que pour une réservation normale).
        const due = Number(entry.data?.dueCents ?? 0);
        const overpaid = Number(entry.data?.overpaidCents ?? 0);
        const increased =
          Number(entry.data?.toAmountCents ?? 0) > Number(entry.data?.fromAmountCents ?? 0);
        const payUrl =
          loaded.channel && increased && due > 0 && awaitsOnlinePayment(booking, loaded.paid)
            ? loaded.channel.kind === "stripe"
              ? linkRequestUrl
              : loaded.channel.url
            : null;
        await send(
          to,
          bookingRescheduledEmail({
            ...mail(linkRequestUrl),
            due: payUrl ? formatMoney(due) : null,
            payUrl,
          }),
        );
        // Plus cher ou moins cher : l'équipe le sait (moins cher : rien n'est remboursé tout seul).
        const repriced = entry.data?.fromAmountCents !== entry.data?.toAmountCents;
        const difference = !repriced
          ? null
          : overpaid > 0
            ? `trop-perçu de ${formatMoney(overpaid)} à rembourser`
            : due > 0
              ? `${formatMoney(due)} restent à payer`
              : null;
        if (difference && entry.actorType === "customer") {
          await notifyTeam(
            entry.organizationId,
            "booking_rescheduled",
            teamBookingEmail({
              workspaceName: workspace.name,
              kind: "rescheduled",
              customerName,
              title,
              seats: booking.seats,
              status: difference,
              url: adminUrl,
            }),
            {
              title: `Changement de date · ${difference}`,
              body: summary,
              link: adminPath,
            },
          );
        }
        break;
      }
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
                  : reason === "minimum_not_reached"
                    ? "le nombre minimum d'inscrits n'a pas été atteint, l'événement est annulé"
                    : reason === "event_cancelled"
                      ? "l'événement est annulé"
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
            { title: "Réservation annulée par le client", body: summary, link: adminPath },
          );
        }
        break;
      }
    }
    // Chaque place prise peut faire passer la jauge à 80 %.
    if (
      booking.event &&
      ["booking.created", "booking.confirmed", "booking.promoted"].includes(entry.action)
    ) {
      await notifyAlmostFull(booking.event.id);
    }
  }
}
