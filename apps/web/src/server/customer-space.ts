/**
 * Espace client (lot 29) : connexion par lien magique, accueil, détail d'une réservation,
 * profil, vue neutre horaya.app et agenda personnel. Session client à part de celle des
 * organisateurs (Better Auth) : son propre cookie, jamais l'un pour l'autre.
 */
import {
  acceptsPass,
  amountDueOnline,
  awaitsOnlinePayment,
  bookMakeupAsCustomer,
  type CustomerAccount,
  cancelAbsenceAsCustomer,
  cancelBookingAsCustomer,
  cancellationPolicyOf,
  customerAccountForSession,
  deleteCustomerAccount,
  enrollmentProgress,
  LOGIN_LINK_MINUTES,
  passSessionsFor,
  reportAbsenceAsCustomer,
  requestCustomerLoginLink,
  rescheduleBookingAsCustomer,
  rescheduleClosedReason,
  rescheduleDeadline,
  reschedulePricing,
  rescheduleTargetIssue,
  signInWithLoginLink,
  signOutCustomer,
  updateCustomerProfile,
} from "@horaya/core";
import {
  type AccountBooking,
  findCustomerAccountByCalendarToken,
  findCustomerIdByEmail,
  getAccountBooking,
  getEnrollment,
  listAccountBookings,
  listCandidatesForTypes,
  listCustomerEnrollmentIds,
  listMakeupTargets,
  listRescheduleCandidates,
  listUsablePasses,
} from "@horaya/db";
import { customerLoginEmail } from "@horaya/mail";
import { notFound, redirect } from "@tanstack/react-router";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { customerFeedIcs, FEED_DAYS_AFTER, FEED_DAYS_BEFORE } from "@/lib/calendar-feed";
import { textOn } from "@/lib/colors";
import { isUpcoming } from "@/lib/customer-space";
import { enrollmentPayment } from "@/lib/enrollment";
import { buildIcs } from "@/lib/ics";
import { withParams } from "@/lib/search-params";
import { db } from "./db";
import { env } from "./env";
import { type FormState, toFormState } from "./form-state";
import { giftCardsForCustomer } from "./gift-cards";
import { absoluteUrl, mailer } from "./mailer";
import { authCookiePrefix } from "./poste";
import { getWorkspaceBySlug, workspacePaymentChannel } from "./public";
import { bookingMoney, checkoutUrl, publicWorkspace } from "./public-booking";
import { clientIp, rateLimited } from "./rate-limit";
import { deps } from "./services";

/** Comme Better Auth, un préfixe par poste : les cookies ne tiennent pas compte du port. */
const COOKIE = `${authCookiePrefix(env.POSTE) ?? "horaya"}.espace_client`;
const DAY = 86_400_000;

/** Accueil de l'espace : chez un atelier (`slug`) ou sur horaya.app (null, maquette 8.5). */
const spaceHome = (slug: string | null) => (slug ? `/${slug}/mon-espace` : "/mon-espace");
const loginPath = (slug: string | null) => `${spaceHome(slug)}/connexion`;
const feedUrl = (token: string, slug: string | null) =>
  absoluteUrl(withParams(`/agenda/client/${token}.ics`, { espace: slug ?? undefined }));

/** Compte client connecté, ou null. */
export async function currentCustomerAccount(): Promise<CustomerAccount | null> {
  const token = getCookie(COOKIE);
  return token ? customerAccountForSession(deps, token) : null;
}

async function requireAccount(slug: string | null): Promise<CustomerAccount> {
  const account = await currentCustomerAccount();
  if (!account) throw redirect({ href: loginPath(slug) });
  return account;
}

/** Carte d'une réservation (accueil, vue horaya.app) : paiement attendu, changement de date. */
function toCard(row: AccountBooking, now: Date, candidates: Candidates) {
  const channel = workspacePaymentChannel(row.workspace, row.paymentMode, row.eventPaymentLinkUrl);
  const payable = channel !== null && awaitsOnlinePayment(row);
  return {
    id: row.id,
    eventId: row.eventId,
    /** Séance d'une inscription au trimestre (lot 30) : absence plutôt qu'annulation. */
    enrollmentId: row.enrollmentId,
    slug: row.workspace.slug,
    timezone: row.workspace.timezone,
    title: row.eventTitle ?? "Location de matériel",
    status: row.status,
    paymentStatus: row.paymentStatus,
    amountCents: row.amountCents,
    seats: row.seats,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    locationName: row.locationName,
    payable,
    pay: payable
      ? { due: amountDueOnline(row), url: channel?.kind === "link" ? channel.url : null }
      : null,
    // Même règle que le détail : délai, et au moins une autre date possible.
    reschedulable:
      row.kind === "event" &&
      row.enrollmentId === null &&
      row.startsAt !== null &&
      row.eventId !== null &&
      row.eventTypeId !== null &&
      row.eventPaymentMode !== null &&
      rescheduleClosedReason({
        status: row.status,
        startsAt: row.startsAt,
        now,
        freeCancellationHours: row.freeCancellationHours,
      }) === null &&
      (candidates.get(row.eventTypeId) ?? []).some(
        (to) =>
          rescheduleTargetIssue({
            from: {
              id: row.eventId as string,
              eventTypeId: row.eventTypeId as string,
              priceCents: row.eventPriceCents ?? 0,
              paymentMode: row.eventPaymentMode as NonNullable<typeof row.eventPaymentMode>,
            },
            to: { ...to, minAdvanceHours: to.modules.opening?.closesHoursBefore },
            seats: row.seats,
            now,
          }) === null,
      ),
  };
}

/** Une réservation (ou une séance de série) à venir ou passée. */
export type CustomerSessionCard = ReturnType<typeof toCard>;
/** Inscription à une série (lot 30) : sa carte unique porte la progression et les séances à venir. */
export interface CardSeries {
  progress: NonNullable<Awaited<ReturnType<typeof enrollmentOf>>>["progress"];
  sessions: CustomerSessionCard[];
}
export type CustomerBookingCard = CustomerSessionCard & { series: CardSeries | null };

type Candidates = Map<string, Awaited<ReturnType<typeof listCandidatesForTypes>>>;

/** Une seule requête pour les dates de remplacement de toutes les cartes. */
async function split(rows: AccountBooking[], now: Date) {
  const types = [
    ...new Set(
      rows.flatMap((row) =>
        row.kind === "event" && row.startsAt && row.startsAt > now && row.eventTypeId
          ? [row.eventTypeId]
          : [],
      ),
    ),
  ];
  const candidates: Candidates = new Map();
  for (const to of await listCandidatesForTypes(db, types, now))
    candidates.set(to.eventTypeId, [...(candidates.get(to.eventTypeId) ?? []), to]);
  const cards = rows.map((row) => toCard(row, now, candidates));
  // Une seule carte par inscription à une série (celle de sa prochaine séance), pas une par séance.
  const upcoming: CustomerBookingCard[] = [];
  const series = new Map<string, CustomerBookingCard>();
  for (const card of cards.filter((c) => isUpcoming(c, now))) {
    const id = card.enrollmentId;
    if (!id) {
      upcoming.push({ ...card, series: null });
      continue;
    }
    const head = series.get(id);
    if (head) {
      head.series?.sessions.push(card);
      continue;
    }
    const row = rows.find((r) => r.id === card.id);
    const enrollment = row
      ? await enrollmentOf({ id: row.organizationId, paymentLinkUrl: null }, id, now)
      : null;
    const entry: CustomerBookingCard = {
      ...card,
      series: enrollment ? { progress: enrollment.progress, sessions: [card] } : null,
    };
    // Inscription introuvable ou annulée : on garde les séances à l'unité.
    if (enrollment) series.set(id, entry);
    upcoming.push(entry);
  }
  return {
    upcoming,
    // Le plus récent d'abord.
    history: cards
      .filter((card) => !isUpcoming(card, now))
      .map((card) => ({ ...card, series: null }))
      .reverse(),
  };
}

/** Inscription au trimestre (lot 30) : progression et paiement, null si elle est terminée. */
async function enrollmentOf(
  workspace: { id: string; paymentLinkUrl: string | null },
  enrollmentId: string,
  now: Date,
) {
  const enrollment = await getEnrollment(db, workspace.id, { id: enrollmentId });
  if (!enrollment || enrollment.cancelledAt) return null;
  return {
    amountCents: enrollment.amountCents,
    progress: enrollmentProgress(enrollment.sessions, now),
    payment: enrollmentPayment(enrollment, workspace.paymentLinkUrl),
  };
}

/* ---------- Connexion ---------- */

/** Maquette 8.1 : déjà connecté (et pas de lien à utiliser), on va droit à l'accueil. */
export async function customerLoginPage(slug: string | null, token: string | undefined) {
  if (slug) await publicWorkspace(slug);
  if (!token && (await currentCustomerAccount())) throw redirect({ href: spaceHome(slug) });
  return { linkMinutes: LOGIN_LINK_MINUTES };
}

/** Envoie le lien magique, sans dire si l'adresse est connue (le premier lien crée l'espace). */
export async function sendCustomerLoginLink(
  slug: string | null,
  form: FormData,
): Promise<FormState> {
  const workspace = slug ? await publicWorkspace(slug) : null;
  const email = String(form.get("email") ?? "").trim();
  const blocked =
    (await rateLimited(`login:ip:${await clientIp()}`, 10, 3600)) ??
    (await rateLimited(`login:email:${email.toLowerCase()}`, 3, 900));
  if (blocked) return { error: blocked };
  try {
    const link = await requestCustomerLoginLink(deps, {
      email,
      organizationId: workspace?.id ?? null,
    });
    await mailer.send(
      link.email,
      customerLoginEmail({
        url: absoluteUrl(withParams(loginPath(slug), { jeton: link.token })),
        minutes: LOGIN_LINK_MINUTES,
        workspace: workspace
          ? {
              name: workspace.name,
              color: workspace.brandColor,
              textColor: textOn(workspace.brandColor),
              logo: workspace.logo ? absoluteUrl(workspace.logo) : null,
            }
          : undefined,
      }),
    );
    return { success: link.email };
  } catch (error) {
    return toFormState(error);
  }
}

/**
 * Le lien de l'e-mail ouvre la page de connexion ; c'est le bouton qui consomme le jeton (un
 * antivirus de messagerie qui ouvre le lien ne le grille donc pas).
 */
export async function signInCustomer(slug: string | null, token: string): Promise<FormState> {
  let sessionToken: string;
  try {
    ({ sessionToken } = await signInWithLoginLink(deps, token));
  } catch (error) {
    return toFormState(error);
  }
  setCookie(COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.BETTER_AUTH_URL.startsWith("https:"),
    path: "/",
    maxAge: 30 * 86_400,
  });
  throw redirect({ href: spaceHome(slug) });
}

export async function signOutCustomerSession(slug: string | null): Promise<never> {
  const token = getCookie(COOKIE);
  if (token) await signOutCustomer(deps, token);
  deleteCookie(COOKIE, { path: "/" });
  throw redirect({ href: loginPath(slug) });
}

/* ---------- Pages ---------- */

/** Maquette 8.2 : le prochain cours, les suivants, l'historique, l'agenda et le profil. */
export async function customerHome(slug: string) {
  const workspace = await publicWorkspace(slug);
  const account = await requireAccount(slug);
  const now = new Date();
  const rows = await listAccountBookings(db, account.email, workspace.id);
  return {
    account,
    now,
    ...(await split(rows, now)),
    freeCancellationHours: workspace.freeCancellationHours,
    feedUrl: feedUrl(account.calendarToken, slug),
  };
}

/** Lot 32 : « Mes bons cadeaux », ceux de l'e-mail du compte connecté (jamais un e-mail saisi). */
export async function customerGiftCards(slug: string) {
  const workspace = await publicWorkspace(slug);
  const account = await requireAccount(slug);
  return giftCardsForCustomer(workspace.id, account.email);
}

/**
 * Séances à rattraper du client connecté (ses inscriptions en cours) : disponibles, avec les
 * séances où il peut les rattraper, ou déjà rattrapées. Le prochain état de chaque absence
 * (annulable tant que la séance n'a pas commencé) vient de `absentStartsAt`.
 */
export async function customerMakeups(slug: string) {
  const workspace = await publicWorkspace(slug);
  const account = await requireAccount(slug);
  const now = new Date();
  const customerId = await findCustomerIdByEmail(db, workspace.id, account.email);
  if (!customerId) return [];
  const result = [];
  for (const id of await listCustomerEnrollmentIds(db, workspace.id, customerId)) {
    const enrollment = await getEnrollment(db, workspace.id, { id }, now);
    if (!enrollment?.makeupAllowed) continue;
    for (const makeup of enrollment.makeups) {
      result.push({
        ...makeup,
        targets:
          makeup.state === "available"
            ? await listMakeupTargets(db, workspace.id, {
                absentEventId: makeup.absentEventId,
                seriesId: enrollment.seriesId,
                customerId,
                now,
                publicOnly: true,
              })
            : [],
      });
    }
  }
  return result;
}

/** Maquette 8.3 : une réservation, son paiement, l'agenda, changer de date, annuler. */
export async function customerBookingPage(slug: string, bookingId: string) {
  const workspace = await publicWorkspace(slug);
  const account = await requireAccount(slug);
  const booking = await getAccountBooking(db, workspace.id, bookingId, account.email);
  if (!booking) throw notFound();
  const now = new Date();
  const money = await bookingMoney(workspace, booking, now);
  const startsAt = booking.eventStartsAt;
  // Règle d'annulation de l'événement (module Annulation), sinon de la structure.
  const policy = cancellationPolicyOf(booking.eventModules ?? {}, workspace);
  const closed = booking.enrollmentId
    ? "Séance de ton inscription au trimestre : signale plutôt ton absence"
    : booking.eventId && booking.eventTypeId && startsAt
      ? rescheduleClosedReason({
          status: booking.status,
          startsAt,
          now,
          freeCancellationHours: policy.freeCancellationHours,
        })
      : "Pas de changement de date pour une location";
  const from =
    booking.eventId && booking.eventTypeId && booking.eventPaymentMode
      ? {
          id: booking.eventId,
          eventTypeId: booking.eventTypeId,
          priceCents: booking.priceCents ?? 0,
          paymentMode: booking.eventPaymentMode,
        }
      : null;
  const options =
    closed === null && from
      ? (
          await listRescheduleCandidates(
            db,
            workspace.id,
            { eventId: from.id, eventTypeId: from.eventTypeId },
            now,
          )
        )
          .map((candidate) => ({
            ...candidate,
            minAdvanceHours: candidate.modules.opening?.closesHoursBefore,
          }))
          .filter((to) => rescheduleTargetIssue({ from, to, seats: booking.seats, now }) === null)
          .slice(0, 6)
          .map((to) => ({
            id: to.id,
            startsAt: to.startsAt,
            endsAt: to.endsAt,
            remaining: to.capacity === null ? null : to.capacity - to.seatsHeld,
            // Écart de prix pour ces places, mêmes tarifs et options (une carte ne change rien).
            deltaCents:
              reschedulePricing({ booking, to, paidCents: money.paid }).amountCents -
              booking.amountCents,
          }))
      : [];
  // Lot 31 : « Payer avec ma carte » si la réservation reste à régler et qu'une carte du client
  // accepte ce type d'événement avec assez de séances.
  const customerId =
    booking.kind === "event" &&
    booking.amountCents > 0 &&
    ["pending", "confirmed"].includes(booking.status) &&
    ["none", "failed"].includes(booking.paymentStatus) &&
    money.paid === 0
      ? await findCustomerIdByEmail(db, workspace.id, account.email)
      : null;
  const pass = customerId
    ? (
        await listUsablePasses(
          db,
          workspace.id,
          customerId,
          booking.eventTypeId ?? null,
          now,
          startsAt ?? undefined,
        )
      ).find(
        (entry) =>
          acceptsPass(booking.eventModules?.payment_methods, entry) &&
          entry.balance >= passSessionsFor(booking.eventModules?.payment_methods, booking.seats),
      )
    : undefined;
  return {
    booking,
    now,
    ...money,
    pass: pass ? { id: pass.id, name: pass.name, balance: pass.balance } : null,
    enrollment: booking.enrollmentId
      ? await enrollmentOf(workspace, booking.enrollmentId, now)
      : null,
    reschedule: {
      closed,
      deadline: startsAt ? rescheduleDeadline(startsAt, policy.freeCancellationHours) : null,
      options,
    },
  };
}

/** Maquette 8.4 : le profil du compte. */
export async function customerProfilePage(slug: string | null) {
  if (slug) await publicWorkspace(slug);
  return { account: await requireAccount(slug) };
}

/** Maquette 8.5 : toutes les réservations, regroupées par atelier, aux couleurs d'Horaya. */
export async function allCustomerBookings() {
  const account = await requireAccount(null);
  const now = new Date();
  const rows = await listAccountBookings(db, account.email, null);
  const { upcoming, history } = await split(rows, now);
  const workspaces = new Map<string, { name: string; slug: string; brandColor: string }>();
  for (const row of rows) workspaces.set(row.workspace.slug, row.workspace);
  return {
    account,
    now,
    history,
    workspaceCount: workspaces.size,
    groups: [...workspaces.values()]
      .map((workspace) => ({
        workspace,
        upcoming: upcoming.filter((card) => card.slug === workspace.slug),
      }))
      .filter((group) => group.upcoming.length > 0),
    feedUrl: feedUrl(account.calendarToken, null),
  };
}

/* ---------- Actions ---------- */

export async function payCustomerBooking(slug: string, bookingId: string): Promise<FormState> {
  const workspace = await publicWorkspace(slug);
  const account = await requireAccount(slug);
  const booking = await getAccountBooking(db, workspace.id, bookingId, account.email);
  if (!booking) return { error: "Réservation introuvable." };
  let url: string;
  try {
    url = await checkoutUrl(
      `${spaceHome(slug)}/${booking.id}`,
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

export async function cancelCustomerBooking(slug: string, bookingId: string): Promise<FormState> {
  const workspace = await publicWorkspace(slug);
  const account = await requireAccount(slug);
  try {
    await cancelBookingAsCustomer(deps, workspace.id, bookingId, account.email);
  } catch (error) {
    return toFormState(error);
  }
  return { success: "Réservation annulée. Un e-mail de confirmation est parti." };
}

export async function rescheduleCustomerBooking(
  slug: string,
  bookingId: string,
  eventId: string,
): Promise<FormState> {
  const workspace = await publicWorkspace(slug);
  const account = await requireAccount(slug);
  try {
    await rescheduleBookingAsCustomer(deps, workspace.id, bookingId, account.email, eventId);
  } catch (error) {
    return toFormState(error);
  }
  return {
    success: "C'est fait : ta réservation a changé de date. Un e-mail récapitulatif est parti.",
  };
}

/** Lot 30 : « Je serai absent·e » sur une séance de son inscription, en étant connecté. */
export async function reportCustomerAbsence(slug: string, bookingId: string): Promise<FormState> {
  const workspace = await publicWorkspace(slug);
  const account = await requireAccount(slug);
  try {
    await reportAbsenceAsCustomer(deps, workspace.id, bookingId, account.email);
  } catch (error) {
    return toFormState(error);
  }
  return { success: "C'est noté : ta place profite à quelqu'un d'autre." };
}

/** « Annuler mon absence » depuis l'espace client : la place est rendue si elle est libre. */
export async function cancelCustomerAbsence(slug: string, bookingId: string): Promise<FormState> {
  const workspace = await publicWorkspace(slug);
  const account = await requireAccount(slug);
  try {
    await cancelAbsenceAsCustomer(deps, workspace.id, bookingId, account.email);
  } catch (error) {
    return toFormState(error);
  }
  return { success: "C'est noté : ta place t'attend." };
}

/** Réserve une séance à rattraper sur une autre séance du même type. */
export async function bookCustomerMakeup(
  slug: string,
  absentBookingId: string,
  eventId: string,
): Promise<FormState> {
  const workspace = await publicWorkspace(slug);
  const account = await requireAccount(slug);
  try {
    await bookMakeupAsCustomer(deps, workspace.id, absentBookingId, account.email, eventId);
  } catch (error) {
    return toFormState(error);
  }
  return { success: "Rattrapage réservé : ta place est confirmée." };
}

export async function saveCustomerProfile(slug: string | null, form: FormData): Promise<FormState> {
  const workspace = slug ? await publicWorkspace(slug) : null;
  const account = await requireAccount(slug);
  try {
    await updateCustomerProfile(
      deps,
      account,
      {
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        phone: form.get("phone"),
      },
      workspace?.id ?? null,
    );
  } catch (error) {
    return toFormState(error);
  }
  return { success: "Profil enregistré." };
}

export async function deleteCustomerSpace(slug: string | null): Promise<never> {
  const account = await requireAccount(slug);
  await deleteCustomerAccount(deps, account);
  deleteCookie(COOKIE, { path: "/" });
  throw redirect({ href: slug ? `/${slug}` : "/" });
}

/* ---------- Agenda personnel ---------- */

/** /agenda/client/<jeton>.ics (?espace=<adresse> : seulement cet atelier). */
export async function customerFeedResponse(token: string, slug: string | null): Promise<Response> {
  const account = await findCustomerAccountByCalendarToken(db, token);
  const workspace = account && slug ? await getWorkspaceBySlug(slug) : null;
  if (!account || (slug && !workspace)) return new Response("Agenda introuvable", { status: 404 });
  const now = new Date();
  const rows = await listAccountBookings(db, account.email, workspace?.id ?? null);
  const ics = customerFeedIcs({
    name: workspace ? `Mes cours · ${workspace.name}` : "Mes réservations · Horaya",
    now,
    bookings: rows
      .filter(
        (row) =>
          row.startsAt &&
          row.endsAt &&
          row.status !== "waitlisted" &&
          row.endsAt.getTime() > now.getTime() - FEED_DAYS_BEFORE * DAY &&
          row.startsAt.getTime() < now.getTime() + FEED_DAYS_AFTER * DAY,
      )
      .map((row) => ({
        id: row.id,
        title: row.eventTitle ?? "Location de matériel",
        status: row.status,
        startsAt: row.startsAt as Date,
        endsAt: row.endsAt as Date,
        locationName: row.locationName,
        reference: row.reference,
        workspaceName: row.workspace.name,
        url: absoluteUrl(`/${row.workspace.slug}/mon-espace/${row.id}`),
      })),
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="mes-cours.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
}

/** .ics d'une réservation de l'espace client : seulement pour son titulaire connecté. */
export async function customerBookingIcs(slug: string, bookingId: string): Promise<Response> {
  const workspace = await getWorkspaceBySlug(slug);
  const account = await currentCustomerAccount();
  const booking =
    workspace && account && /^[0-9a-f-]{36}$/.test(bookingId)
      ? await getAccountBooking(db, workspace.id, bookingId, account.email)
      : null;
  const startsAt = booking?.eventStartsAt ?? booking?.rentalStartsAt;
  const endsAt = booking?.eventEndsAt ?? booking?.rentalEndsAt;
  if (!workspace || !booking || !startsAt || !endsAt)
    return new Response("Réservation introuvable", { status: 404 });
  const ics = buildIcs({
    uid: `${booking.id}@horaya.app`,
    title: booking.eventTitle ?? "Location de matériel",
    startsAt,
    endsAt,
    location: [booking.locationName, booking.locationAddress].filter(Boolean).join(", ") || null,
    description: `Réservation ${booking.reference} · ${workspace.name}`,
    url: absoluteUrl(`/${slug}/mon-espace/${booking.id}`),
    organizer: workspace.name,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${booking.reference}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
