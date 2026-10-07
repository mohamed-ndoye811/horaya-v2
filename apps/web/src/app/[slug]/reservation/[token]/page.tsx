import {
  amountDueOnline,
  awaitsOnlinePayment,
  hashToken,
  paidCents,
  refundForCancellation,
} from "@horaya/core";
import { getManagedBooking, listBookingPayments } from "@horaya/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BrandBand, PublicNav } from "@/components/public/public-chrome";
import { NotFoundScreen } from "@/components/public/public-not-found";
import { StatusBadge } from "@/components/ui/badge";
import { ArrowRight, Check, DownloadIcon, Envelope } from "@/components/ui/icons";
import { BOOKING_STATUS_BADGE } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { displayFontClass } from "@/lib/fonts";
import { formatEventRange, formatMoney } from "@/lib/format";
import { googleCalendarUrl } from "@/lib/ics";
import { cancellationPolicy } from "@/lib/public-booking";
import { param } from "@/lib/search-params";
import { db } from "@/server/db";
import { getWorkspaceBySlug, workspacePaymentChannel } from "@/server/public";
import { CancelBooking, PayButton, PaymentPending, ResendEmail } from "./manage-actions";

export const metadata: Metadata = { title: "Ta réservation", robots: { index: false } };

/** Écran 19 (juste après la réservation, ?nouvelle=1) et page « Gérer ma réservation ». */
export default async function ManagedBookingPage({
  params,
  searchParams,
}: PageProps<"/[slug]/reservation/[token]">) {
  const { slug, token } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  const booking = await getManagedBooking(db, workspace.id, await hashToken(token));
  if (!booking) {
    return (
      <NotFoundScreen
        wordmark={false}
        title="Ce lien de réservation n'est plus valable."
        text="Un lien plus récent t'a peut-être été envoyé. Demande-en un nouveau avec ton adresse e-mail."
        primary={{ label: "Retrouver mes réservations", href: `/${slug}/mes-reservations` }}
      />
    );
  }
  const query = await searchParams;
  const fresh = param(query.nouvelle) === "1";
  const paymentReturn = param(query.paiement);
  const payments = await listBookingPayments(db, booking.id);
  const paid = paidCents(payments);
  const refunded = payments
    .filter((entry) => entry.kind === "refund" && entry.status === "succeeded")
    .reduce((total, entry) => total + entry.amountCents, 0);
  const channel = workspacePaymentChannel(
    workspace,
    booking.paymentMode,
    booking.eventPaymentLinkUrl,
  );
  const awaitsPayment = channel !== null && awaitsOnlinePayment(booking);
  const due = amountDueOnline(booking);
  const tz = workspace.timezone;
  const startsAt = booking.eventStartsAt ?? booking.rentalStartsAt;
  const endsAt = booking.eventEndsAt ?? booking.rentalEndsAt;
  const title = booking.eventTitle ?? "Location de matériel";
  const active =
    booking.status === "pending" ||
    booking.status === "confirmed" ||
    booking.status === "waitlisted";
  const started = startsAt ? startsAt <= new Date() : false;
  const places = `${booking.seats} place${booking.seats > 1 ? "s" : ""}`;
  const several = booking.seats > 1;
  // « Tes 2 places … sont confirmées » / « Ta place … est confirmée ».
  const yourPlaces = several ? `Tes ${places}` : "Ta place";
  const agree = (singular: string, plural: string) => (several ? plural : singular);
  const where =
    [booking.locationName, booking.locationAddress].filter(Boolean).join(", ") ||
    (booking.onlineUrl ? "En ligne" : null);
  const participants = booking.participants.length
    ? booking.participants.map((entry) => `${entry.firstName} ${entry.lastName}`).join(", ")
    : `${booking.customerFirstName} ${booking.customerLastName}`;
  const manageHref = `/${slug}/reservation/${token}`;

  const heading = (() => {
    if (booking.status === "cancelled")
      return {
        title: "Réservation annulée",
        text: `Ta réservation de ${places} pour « ${title} » est annulée.`,
      };
    if (booking.status === "refused")
      return {
        title: "Demande non retenue",
        text: `${workspace.name} n'a pas pu accepter ta demande pour « ${title} »${booking.refusalReason ? ` (${booking.refusalReason})` : ""}.`,
      };
    if (booking.status === "pending")
      return {
        title: fresh ? "Demande envoyée !" : "En attente de validation",
        text: `Merci ${booking.customerFirstName}. ${yourPlaces} pour « ${title} » ${agree("est retenue", "sont retenues")} en attendant la validation de ${workspace.name} : tu recevras un e-mail.`,
      };
    if (booking.status === "waitlisted")
      return {
        title: "Sur liste d'attente",
        text: `Merci ${booking.customerFirstName}. « ${title} » est complet : si une place se libère, ta demande passe automatiquement et tu es prévenu·e par e-mail.`,
      };
    if (awaitsPayment)
      return {
        title:
          channel?.kind === "stripe" && paymentReturn === "ok"
            ? "Paiement en cours"
            : "Plus qu'à payer",
        text:
          channel?.kind === "link"
            ? `${fresh ? `Merci ${booking.customerFirstName}. ` : ""}${yourPlaces} pour « ${title} » ${agree("est réservée", "sont réservées")} : règle ${formatMoney(due)} via le lien de paiement de ${workspace.name}, qui confirmera la réception par e-mail.`
            : paymentReturn === "ok"
              ? "Stripe confirme ton paiement : ça ne prend que quelques secondes."
              : `${yourPlaces} pour « ${title} » ${agree("est retenue", "sont retenues")} le temps du paiement en ligne (${formatMoney(due)}). Sans paiement, ${agree("elle est libérée", "elles sont libérées")} au bout de 30 minutes.`,
      };
    const paidNote =
      booking.paymentStatus === "paid"
        ? booking.paymentMode === "deposit"
          ? ", acompte payé"
          : agree(" et payée", " et payées")
        : "";
    return {
      title: fresh ? "C'est réservé !" : "Ta réservation",
      text: `${fresh ? `Merci ${booking.customerFirstName}. ` : ""}${yourPlaces} pour « ${title} » ${agree("est confirmée", "sont confirmées")}${paidNote}.`,
    };
  })();

  return (
    <>
      <BrandBand>
        <PublicNav workspace={workspace} active={fresh ? undefined : "bookings"} />
        <div className="flex flex-col gap-8 px-5 pt-10 pb-10 sm:flex-row sm:items-end sm:justify-between sm:gap-12 sm:px-16 sm:pt-16 sm:pb-14">
          <div className="flex flex-col gap-6">
            {fresh && active && !awaitsPayment && (
              <span
                aria-hidden="true"
                className="flex size-[72px] items-center justify-center bg-[var(--on-brand)] text-[var(--brand)]"
              >
                <Check size={36} />
              </span>
            )}
            <h1
              className={cn(
                "text-[56px] leading-[52px] sm:text-[128px] sm:leading-[112px]",
                displayFontClass(workspace.displayFont),
              )}
            >
              {heading.title}
            </h1>
            <p className="max-w-[640px] text-lg font-medium leading-7 sm:text-xl">{heading.text}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <p className="font-mono text-label font-semibold uppercase tracking-[0.055em] opacity-85">
              N° de réservation
            </p>
            <p className="flex h-12 items-center border-2 border-[var(--on-brand)] px-4 font-mono text-xl font-bold">
              {booking.reference}
            </p>
          </div>
        </div>
      </BrandBand>

      <div className="grid lg:grid-cols-[1.3fr_1fr_1fr]">
        <Column first>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-section text-section leading-7 text-ink">Récapitulatif</h2>
            {!fresh && (
              <StatusBadge tone={BOOKING_STATUS_BADGE[booking.status].tone}>
                {BOOKING_STATUS_BADGE[booking.status].label}
              </StatusBadge>
            )}
          </div>
          <Fact label="Quoi">
            {booking.eventSlug && booking.eventVisibility === "public" ? (
              <Link href={`/${slug}/${booking.eventSlug}`} className="hover:underline">
                {title}
              </Link>
            ) : (
              title
            )}
          </Fact>
          {startsAt && endsAt && (
            <Fact label="Quand">{formatEventRange(startsAt, endsAt, tz)}</Fact>
          )}
          {where && <Fact label="Où">{where}</Fact>}
          <Fact label="Participants">{participants}</Fact>
          <div className="flex items-center justify-between gap-4 border-t border-line-soft pt-3.5">
            <span className="text-[15px] font-semibold text-ink-muted">
              {booking.amountCents === 0
                ? places
                : refunded > 0
                  ? `Remboursé ${formatMoney(refunded)}`
                  : paid > 0
                    ? booking.paymentMode === "deposit"
                      ? `Acompte payé · reste ${formatMoney(booking.amountCents - paid)} sur place`
                      : "Payé par carte"
                    : awaitsPayment
                      ? "À payer en ligne"
                      : booking.paymentMode === "on_site"
                        ? "À régler sur place"
                        : "À régler auprès de l'organisateur"}
            </span>
            <span className="text-section font-extrabold leading-[26px] text-ink">
              {booking.amountCents > 0 ? formatMoney(booking.amountCents) : "Gratuit"}
            </span>
          </div>
        </Column>

        <Column>
          <h2 className="font-section text-section leading-7 text-ink">Ajouter à ton agenda</h2>
          {active && startsAt && endsAt ? (
            <>
              <AgendaLink
                href={googleCalendarUrl({
                  title,
                  startsAt,
                  endsAt,
                  location: where,
                  details: `Réservation ${booking.reference} · ${workspace.name}`,
                })}
                external
              >
                Google Agenda
              </AgendaLink>
              <AgendaLink href={`${manageHref}/agenda.ics`}>Apple Calendrier</AgendaLink>
              <AgendaLink href={`${manageHref}/agenda.ics`} download>
                Outlook · fichier .ics
              </AgendaLink>
            </>
          ) : (
            <p className="text-sm font-medium text-ink-muted">
              Cette réservation n'est plus active.
            </p>
          )}
        </Column>

        <Column last>
          <h2 className="font-section text-section leading-7 text-ink">
            {fresh ? "E-mail envoyé" : "Ta réservation"}
          </h2>
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center border-[1.5px] border-success bg-success-bg text-success"
            >
              <Envelope size={18} />
            </span>
            <p className="min-w-0 break-words text-[15px] font-semibold leading-5 text-ink">
              {fresh ? "Confirmation envoyée à " : "Envoyée à "}
              {booking.customerEmail}
            </p>
          </div>
          {active && <ResendEmail slug={slug} token={token} />}
          <div className="mt-auto flex flex-col gap-3 pt-4">
            {awaitsPayment && channel?.kind === "stripe" && paymentReturn === "ok" && (
              <PaymentPending />
            )}
            {awaitsPayment && channel?.kind === "stripe" && paymentReturn !== "ok" && (
              <PayButton slug={slug} token={token} label={`Payer ${formatMoney(due)}`} />
            )}
            {awaitsPayment && channel?.kind === "link" && (
              <>
                <a
                  href={channel.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-14 items-center justify-center gap-3 bg-ink text-[17px] font-extrabold text-on-ink transition-colors hover:bg-info"
                >
                  Payer {formatMoney(due)} ↗
                </a>
                <p className="text-[13px] font-medium text-ink-muted">
                  Le paiement s'ouvre chez le prestataire de {workspace.name}. Tu recevras un reçu
                  dès qu'il est confirmé.
                </p>
              </>
            )}
            {fresh && !awaitsPayment ? (
              <Link
                href={manageHref}
                className="flex h-[52px] items-center justify-center gap-2.5 bg-ink text-base font-extrabold text-on-ink transition-colors hover:bg-info"
              >
                Gérer ma réservation
                <ArrowRight />
              </Link>
            ) : active && !started ? (
              <CancelBooking
                slug={slug}
                token={token}
                policy={
                  paid > 0
                    ? `${cancellationPolicy(startsAt ?? new Date(), workspace, tz)} Tu seras remboursé·e de ${formatMoney(
                        refundForCancellation({
                          paidCents: paid,
                          cancelledBy: "customer",
                          startsAt,
                          now: new Date(),
                          policy: workspace,
                        }),
                      )}.`
                    : startsAt && booking.amountCents > 0
                      ? cancellationPolicy(startsAt, workspace, tz)
                      : null
                }
              />
            ) : (
              <Link
                href={`/${slug}`}
                className="flex h-[52px] items-center justify-center gap-2.5 border-2 border-ink text-base font-bold text-ink hover:bg-surface"
              >
                Voir les événements à venir
              </Link>
            )}
          </div>
        </Column>
      </div>
    </>
  );
}

function Column({
  children,
  first,
  last,
}: {
  children: ReactNode;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 border-ink px-5 py-8 sm:px-12 lg:py-10",
        first && "lg:pl-16",
        last && "lg:pr-16",
        !last && "border-b-2 lg:border-r-2 lg:border-b-0",
      )}
    >
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.66px] text-neutral">
        {label}
      </p>
      <p className="text-[17px] font-bold leading-[22px] text-ink">{children}</p>
    </div>
  );
}

function AgendaLink({
  href,
  children,
  external,
  download,
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
  download?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      {...(download ? { download: "reservation.ics" } : {})}
      className="flex h-12 items-center justify-between border-2 border-ink px-4 text-[15px] font-bold text-ink transition-colors hover:bg-surface"
    >
      {children}
      {download ? <DownloadIcon /> : <ArrowRight />}
    </a>
  );
}
