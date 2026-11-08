import type { ReactNode } from "react";
import { BookingAnswers } from "@/components/app/field-answers";
import { stagger, WordsReveal } from "@/components/motion/words";
import { NotFoundScreen } from "@/components/public/public-not-found";
import { StatusBadge, type Tone } from "@/components/ui/badge";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { ArrowRight } from "@/components/ui/icons";
import { inkCardClasses } from "@/components/ui/section";
import {
  cancelManagedBookingAction,
  type getManagedBookingPage,
  payManagedBookingAction,
} from "@/functions/public";
import { cn } from "@/lib/cn";
import { displayFontClass } from "@/lib/fonts";
import { formatEventRange, formatMoney } from "@/lib/format";
import { googleCalendarUrl } from "@/lib/ics";
import { Link } from "@/lib/navigation";
import { cancellationPolicy } from "@/lib/public-booking";
import { withParams } from "@/lib/search-params";
import { CancelBooking, PayButton, PaymentPending, ResendEmail } from "./manage-actions";

/** Maquette 5.4 : juste après la réservation (?nouvelle=1) et page « Gérer ma réservation ». */
export function ManagedBookingPage({
  token,
  search,
  data,
}: {
  token: string;
  search: { nouvelle?: string; paiement?: string };
  data: Awaited<ReturnType<typeof getManagedBookingPage>>;
}) {
  const { workspace, now } = data;
  const slug = workspace.slug;
  if (!data.booking) {
    return (
      <NotFoundScreen
        wordmark={false}
        title="Ce lien de réservation n'est plus valable."
        text="Un lien plus récent t'a peut-être été envoyé. Demande-en un nouveau avec ton adresse e-mail."
        primary={{ label: "Retrouver mes réservations", href: `/${slug}/mon-espace/connexion` }}
      />
    );
  }
  const { booking, channel, paid, refunded, awaitsPayment, due, refund } = data;
  const fresh = search.nouvelle === "1";
  const paymentReturn = search.paiement;
  const tz = workspace.timezone;
  const startsAt = booking.eventStartsAt ?? booking.rentalStartsAt;
  const endsAt = booking.eventEndsAt ?? booking.rentalEndsAt;
  const title = booking.eventTitle ?? "Location de matériel";
  const active =
    booking.status === "pending" ||
    booking.status === "confirmed" ||
    booking.status === "waitlisted";
  const started = startsAt ? startsAt <= now : false;
  const places = `${booking.seats} place${booking.seats > 1 ? "s" : ""}`;
  const several = booking.seats > 1;
  // « Tes 2 places … sont confirmées » / « Ta place … est confirmée ».
  const yourPlaces = several ? `Tes ${places}` : "Ta place";
  const agree = (singular: string, plural: string) => (several ? plural : singular);
  const where =
    [booking.locationName, booking.locationAddress].filter(Boolean).join(", ") ||
    (booking.onlineUrl ? "En ligne" : null);
  // Une ligne par place (lot 33) : seuls les participants nommés comptent.
  const names = booking.participants
    .map((entry) => `${entry.firstName} ${entry.lastName}`.trim())
    .filter(Boolean);
  const named = names.length
    ? names.join(", ")
    : `${booking.customerFirstName} ${booking.customerLastName}`;
  const missing = booking.seats - Math.max(names.length, 1);
  const participants =
    missing > 0 ? `${named} · ${missing} participant${missing > 1 ? "s" : ""} à compléter` : named;
  const manageHref = `/${slug}/reservation/${token}`;
  const deposit = booking.paymentMode === "deposit";
  // `rest` à côté de la pastille, qui ne passe pas à la ligne (évite qu'elle déborde sur mobile).
  const paymentPill: { label: string; tone: Tone; rest?: string } | null =
    booking.amountCents === 0
      ? null
      : refunded > 0
        ? { label: `Remboursé ${formatMoney(refunded)}`, tone: "draft" }
        : paid > 0
          ? {
              label: deposit ? "Acompte payé" : "Payé",
              rest: deposit
                ? `reste ${formatMoney(booking.amountCents - paid)} sur place`
                : undefined,
              tone: "success",
            }
          : awaitsPayment
            ? {
                label: deposit
                  ? `Acompte de ${formatMoney(due)} à payer`
                  : `${formatMoney(due)} à payer en ligne`,
                rest: deposit
                  ? `reste ${formatMoney(booking.amountCents - due)} sur place`
                  : undefined,
                tone: "warning",
              }
            : {
                label:
                  booking.paymentMode === "on_site"
                    ? "À régler sur place"
                    : "À régler auprès de l'organisateur",
                tone: "draft",
              };
  // « brand » : le seul ton qui n'est pas celui d'un StatusBadge (couleur de l'espace).
  const heading: { title: string; text: string; badge: { label: string; tone: Tone | "brand" } } =
    (() => {
      if (booking.status === "cancelled")
        return {
          badge: { label: "Annulée", tone: "draft" },
          title: "Réservation annulée",
          text: `Ta réservation de ${places} pour « ${title} » est annulée.`,
        };
      if (booking.status === "refused")
        return {
          badge: { label: "Non retenue", tone: "danger" },
          title: "Demande non retenue",
          text: `${workspace.name} n'a pas pu accepter ta demande pour « ${title} »${booking.refusalReason ? ` (${booking.refusalReason})` : ""}.`,
        };
      if (booking.status === "pending")
        return {
          badge: { label: "En attente de validation", tone: "info" },
          title: fresh ? "Demande envoyée !" : "En attente de validation",
          text: `Merci ${booking.customerFirstName}. ${yourPlaces} pour « ${title} » ${agree("est retenue", "sont retenues")} en attendant la validation de ${workspace.name} : tu recevras un e-mail.`,
        };
      if (booking.status === "waitlisted")
        return {
          badge: { label: "Liste d'attente", tone: "warning" },
          title: "Sur liste d'attente",
          text: `Merci ${booking.customerFirstName}. « ${title} » est complet : si une place se libère, ta demande passe automatiquement et tu es prévenu·e par e-mail.`,
        };
      if (awaitsPayment)
        return {
          badge: { label: "Plus qu'à payer", tone: "brand" },
          title:
            channel?.kind === "stripe" && paymentReturn === "ok"
              ? "Paiement en cours"
              : several
                ? "Tes places sont réservées."
                : "Ta place est réservée.",
          text:
            channel?.kind === "link"
              ? `${fresh ? `Merci ${booking.customerFirstName}. ` : ""}${yourPlaces} pour « ${title} » ${agree("est réservée", "sont réservées")} : règle ${booking.paymentMode === "deposit" ? "l'acompte de " : ""}${formatMoney(due)} via le lien de paiement de ${workspace.name}, qui confirmera la réception par e-mail.`
              : paymentReturn === "ok"
                ? "Stripe confirme ton paiement : ça ne prend que quelques secondes."
                : `${yourPlaces} pour « ${title} » ${agree("est retenue", "sont retenues")} le temps du paiement en ligne (${formatMoney(due)}). Sans paiement, ${agree("elle est libérée", "elles sont libérées")} au bout de 30 minutes.`,
        };
      const paidNote =
        booking.paymentStatus === "paid_with_pass"
          ? agree(" et payée avec ta carte", " et payées avec ta carte")
          : booking.paymentStatus === "paid"
            ? booking.paymentMode === "deposit"
              ? ", acompte payé"
              : agree(" et payée", " et payées")
            : "";
      return {
        badge: { label: "Confirmée", tone: "success" },
        title: fresh ? "C'est réservé !" : "Ta réservation",
        text: `${fresh ? `Merci ${booking.customerFirstName}. ` : ""}${yourPlaces} pour « ${title} » ${agree("est confirmée", "sont confirmées")}${paidNote}.`,
      };
    })();

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4">
      <section className={cn(inkCardClasses, "flex flex-col gap-[18px] rounded-3xl p-6 sm:p-8")}>
        {heading.badge.tone === "brand" ? (
          <span className="h-6 w-fit rounded-full bg-[color-mix(in_srgb,var(--brand)_20%,transparent)] px-2.5 text-xs font-bold leading-6 text-[var(--brand-light)]">
            {heading.badge.label}
          </span>
        ) : (
          <span className="w-fit">
            <StatusBadge tone={heading.badge.tone}>{heading.badge.label}</StatusBadge>
          </span>
        )}
        <h1
          className={cn(
            "text-[36px] leading-10 tracking-[-0.04em] sm:text-[48px] sm:leading-[52px]",
            displayFontClass(workspace.displayFont),
          )}
        >
          <WordsReveal>{heading.title}</WordsReveal>
        </h1>
        <p
          className="reveal max-w-[620px] text-[17px] leading-[26px] text-on-ink/75"
          style={stagger(3)}
        >
          {heading.text}
        </p>
        <div className="flex flex-col gap-3.5 pt-1 sm:flex-row sm:items-center">
          {awaitsPayment && channel?.kind === "stripe" && paymentReturn === "ok" && (
            <PaymentPending />
          )}
          {awaitsPayment && channel?.kind === "stripe" && paymentReturn !== "ok" && (
            <PayButton
              pay={() => payManagedBookingAction(slug, token)}
              label={`Payer ${formatMoney(due)}`}
            />
          )}
          {awaitsPayment && channel?.kind === "link" && (
            <ButtonLink
              href={channel.url}
              target="_blank"
              rel="noreferrer"
              variant="brand"
              size="xl"
            >
              Payer {formatMoney(due)} ↗
            </ButtonLink>
          )}
          {fresh && !awaitsPayment && (
            <ButtonLink href={manageHref} variant="inverse" size="xl" arrow>
              Gérer ma réservation
            </ButtonLink>
          )}
          <div className="flex flex-col gap-1 text-sm leading-[18px] text-notch-idle">
            <p>
              {fresh ? "Confirmation envoyée à " : "Envoyée à "}
              <span className="break-all font-semibold text-on-ink">{booking.customerEmail}</span>
            </p>
            {active && <ResendEmail slug={slug} token={token} />}
          </div>
        </div>
      </section>

      {fresh && (
        <Link
          href={withParams(`/${slug}/mon-espace/connexion`, {
            email: booking.customerEmail ?? undefined,
          })}
          className="flex items-center justify-between gap-3 rounded-[20px] bg-surface px-5 py-[18px] text-ink hover:bg-field"
        >
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold leading-5">
              Retrouver tes cours dans ton espace
            </span>
            <span className="text-[13px] leading-[18px] text-ink-muted">
              Tes réservations, ton agenda et ton profil chez {workspace.name}, sans mot de passe.
            </span>
          </span>
          <ArrowRight />
        </Link>
      )}

      <section className="flex flex-col rounded-3xl bg-surface px-6 py-2">
        <div className="flex h-14 items-center justify-between gap-4">
          <h2 className="text-lg font-semibold leading-[22px] text-ink">Récapitulatif</h2>
          <p className="font-mono text-xs leading-4 text-ink-subtle">Réf. {booking.reference}</p>
        </div>
        <dl className="flex flex-col">
          <Fact label="Quoi">
            {booking.eventSlug && booking.eventVisibility === "public" ? (
              <Link href={`/${slug}/${booking.eventSlug}`} className="underline underline-offset-2">
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
          {(Object.keys(booking.answers ?? {}).length > 0 ||
            booking.participants.some((entry) => Object.keys(entry.answers).length > 0)) && (
            <Fact label="Tes réponses">
              <BookingAnswers
                fields={booking.eventFields}
                answers={booking.answers ?? {}}
                participants={booking.participants}
                timeZone={tz}
              />
            </Fact>
          )}
          <Fact label="Paiement">
            <span className="flex flex-wrap items-center gap-2.5">
              {booking.amountCents > 0 ? formatMoney(booking.amountCents) : "Gratuit"}
              {paymentPill && (
                <StatusBadge tone={paymentPill.tone}>{paymentPill.label}</StatusBadge>
              )}
              {paymentPill?.rest && (
                <span className="text-[13px] font-medium text-ink-muted">{paymentPill.rest}</span>
              )}
            </span>
          </Fact>
        </dl>
      </section>

      <div className="flex flex-col gap-4 sm:flex-row">
        {active && startsAt && endsAt ? (
          <div className="flex flex-1 flex-wrap items-center justify-between gap-3 rounded-[20px] bg-surface px-5 py-[18px]">
            <h2 className="text-[15px] font-semibold leading-5 text-ink">Ajouter à ton agenda</h2>
            <div className="flex gap-1.5">
              <AgendaLink href={`${manageHref}/agenda.ics`}>Apple</AgendaLink>
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
                Google
              </AgendaLink>
              <AgendaLink href={`${manageHref}/agenda.ics`} download>
                Outlook
              </AgendaLink>
            </div>
          </div>
        ) : (
          <Link
            href={`/${slug}`}
            className="flex flex-1 items-center justify-between gap-3 rounded-[20px] bg-surface px-5 py-[18px] text-[15px] font-semibold text-ink hover:bg-field"
          >
            Voir les événements à venir
            <ArrowRight />
          </Link>
        )}
        {active && !started && (
          <div className="flex items-center justify-between gap-3 rounded-[20px] bg-surface px-5 py-[18px] sm:w-[300px]">
            <h2 className="text-[15px] font-semibold leading-5 text-ink">Un empêchement ?</h2>
            <CancelBooking
              cancel={() => cancelManagedBookingAction(slug, token)}
              description={`${yourPlaces} pour « ${title} » ${agree("sera libérée", "seront libérées")} pour d'autres participants.`}
              refund={
                refund === null
                  ? null
                  : {
                      label:
                        refund >= paid
                          ? "Remboursement intégral"
                          : refund > 0
                            ? "Remboursement partiel"
                            : "Pas de remboursement",
                      amount: formatMoney(refund),
                      tone: refund >= paid ? "success" : refund > 0 ? "warning" : "draft",
                      text: cancellationPolicy(startsAt ?? now, workspace, tz),
                    }
              }
              policy={
                refund === null && startsAt && booking.amountCents > 0
                  ? cancellationPolicy(startsAt, workspace, tz)
                  : null
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-bg py-3.5 sm:min-h-[52px] sm:flex-row sm:items-center sm:py-2">
      <dt className="text-sm leading-[18px] text-ink-subtle sm:w-40 sm:shrink-0">{label}</dt>
      <dd className="text-[15px] font-semibold leading-5 text-ink">{children}</dd>
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
      className={buttonClasses({ variant: "soft", size: "xs" })}
    >
      {children}
    </a>
  );
}
