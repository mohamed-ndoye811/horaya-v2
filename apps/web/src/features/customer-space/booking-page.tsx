import { type ReactNode, useState } from "react";
import { BookingAnswers } from "@/components/app/field-answers";
import { StatusBadge, type Tone } from "@/components/ui/badge";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormAlert } from "@/components/ui/form-alert";
import { ArrowLeft } from "@/components/ui/icons";
import {
  AbsenceButton,
  CancelAbsenceButton,
  EnrollmentProgress,
} from "@/features/enrollments/enrollment-progress";
import {
  cancelCustomerAbsenceAction,
  cancelCustomerBookingAction,
  type getCustomerBookingPage,
  reportCustomerAbsenceAction,
  rescheduleCustomerBookingAction,
} from "@/functions/customer-space";
import { cn } from "@/lib/cn";
import { cardDate } from "@/lib/customer-space";
import { formatEventRange, formatMoney, plural } from "@/lib/format";
import { googleCalendarUrl } from "@/lib/ics";
import { Link, useRouter } from "@/lib/navigation";
import { cancellationPolicy } from "@/lib/public-booking";
import { CancelBooking } from "../public/manage-actions";
import { PayAction, PayWithPassAction } from "./actions";
import { SpaceAside, SpaceTitle } from "./space-layout";

type Data = Awaited<ReturnType<typeof getCustomerBookingPage>>;
type Workspace = {
  name: string;
  slug: string;
  displayFont: string;
  timezone: string;
  coverImageUrl: string | null;
  freeCancellationHours: number;
  lateCancellationRefundPercent: number;
};

const STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "En attente de validation", tone: "info" },
  waitlisted: { label: "Liste d'attente", tone: "warning" },
  cancelled: { label: "Annulée", tone: "draft" },
  refused: { label: "Non retenue", tone: "danger" },
};

/** Maquette 8.3 : une réservation (payer, agenda, changer de date, annuler). */
export function CustomerBookingPage({
  workspace,
  data,
  paymentReturn,
}: {
  workspace: Workspace;
  data: Data;
  paymentReturn: string | undefined;
}) {
  const { booking, now, awaitsPayment, due, channel, paid, refund, reschedule, enrollment, pass } =
    data;
  const slug = workspace.slug;
  const tz = workspace.timezone;
  const title = booking.eventTitle ?? "Location de matériel";
  const startsAt = booking.eventStartsAt ?? booking.rentalStartsAt;
  const endsAt = booking.eventEndsAt ?? booking.rentalEndsAt;
  const active = ["pending", "confirmed", "waitlisted"].includes(booking.status);
  const places = `${booking.seats} place${booking.seats > 1 ? "s" : ""}`;
  const booked = new Intl.DateTimeFormat("fr-FR", {
    timeZone: tz,
    day: "numeric",
    month: "long",
  }).format(booking.createdAt);
  const badge: { label: string; tone: Tone } =
    (booking.absentAt ? { label: "Absence signalée", tone: "neutral" } : null) ??
    STATUS[booking.status] ??
    (booking.enrollmentId ? { label: "Inscrit·e au trimestre", tone: "info" } : null) ??
    (awaitsPayment
      ? { label: `À payer · ${formatMoney(due)}`, tone: "warning" }
      : booking.paymentStatus === "paid"
        ? { label: "Payée", tone: "success" }
        : booking.paymentStatus === "paid_with_pass"
          ? { label: "Payée avec ta carte", tone: "success" }
          : { label: "Confirmée", tone: "success" });
  const where = [booking.locationName, booking.locationAddress].filter(Boolean).join(", ");
  const cancel = startsAt && startsAt > now && (
    <CancelBooking
      cancel={() => cancelCustomerBookingAction(slug, booking.id)}
      trigger="Annuler ma réservation"
      asButton
      description={`${booking.seats > 1 ? `Tes ${places}` : "Ta place"} pour « ${title} » ${booking.seats > 1 ? "seront libérées" : "sera libérée"} pour d'autres participants.`}
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
              text: cancellationPolicy(startsAt, workspace, tz),
            }
      }
      policy={
        refund === null && booking.amountCents > 0
          ? cancellationPolicy(startsAt, workspace, tz)
          : null
      }
    />
  );

  return (
    <div className="flex flex-col gap-4 lg:min-h-[640px] lg:flex-row">
      <section className="flex flex-1 flex-col rounded-3xl bg-surface px-5 pt-6 pb-8 sm:px-11 sm:pt-10 sm:pb-11">
        <div className="reveal-group flex max-w-[620px] flex-col gap-8">
          <Link
            href={`/${slug}/mon-espace`}
            className="tap-area flex w-fit items-center gap-1.5 text-sm font-semibold leading-[18px] text-ink-muted hover:text-ink"
          >
            <ArrowLeft />
            Mon espace
          </Link>

          <div className="flex flex-col gap-3">
            <span className="w-fit">
              <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
            </span>
            <SpaceTitle displayFont={workspace.displayFont}>{title}</SpaceTitle>
            <p className="text-base leading-6 text-ink-muted">
              {[
                startsAt && endsAt ? formatEventRange(startsAt, endsAt, tz) : null,
                places,
                where || null,
                `réservé le ${booked}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {paymentReturn === "ok" && awaitsPayment && (
              <FormAlert tone="info">
                Paiement reçu par Stripe : la confirmation arrive dans quelques secondes.
              </FormAlert>
            )}
          </div>

          {active && (
            <div className="flex flex-wrap gap-2.5">
              {awaitsPayment && channel && (
                <PayAction
                  slug={slug}
                  bookingId={booking.id}
                  size="lg"
                  pay={{ due, url: channel.kind === "link" ? channel.url : null }}
                />
              )}
              {pass && (
                <PayWithPassAction slug={slug} bookingId={booking.id} pass={pass} size="lg" />
              )}
              {startsAt && endsAt && (
                <AgendaButton
                  ics={`/${slug}/mon-espace/${booking.id}/agenda.ics`}
                  google={googleCalendarUrl({
                    title,
                    startsAt,
                    endsAt,
                    location: where || null,
                    details: `Réservation ${booking.reference} · ${workspace.name}`,
                  })}
                />
              )}
            </div>
          )}

          {(Object.keys(booking.answers).length > 0 ||
            booking.participants.some((entry) => Object.keys(entry.answers).length > 0)) && (
            <div className="flex flex-col gap-3.5 border-t border-line pt-7">
              <h2 className="text-lg font-semibold leading-6 text-ink">Tes réponses</h2>
              <BookingAnswers
                fields={booking.eventFields}
                answers={booking.answers}
                participants={booking.participants}
                timeZone={tz}
              />
            </div>
          )}

          {booking.enrollmentId && enrollment && (
            <Enrollment
              enrollment={enrollment}
              timezone={tz}
              absence={
                booking.eventId &&
                startsAt &&
                startsAt > now &&
                (booking.absentAt ? (
                  <CancelAbsenceButton
                    session={{ eventId: booking.eventId, title, startsAt }}
                    timeZone={tz}
                    onCancel={() => cancelCustomerAbsenceAction(slug, booking.id)}
                  />
                ) : (
                  active && (
                    <AbsenceButton
                      session={{ eventId: booking.eventId, title, startsAt }}
                      timeZone={tz}
                      onAbsent={() => reportCustomerAbsenceAction(slug, booking.id)}
                    />
                  )
                ))
              }
            />
          )}

          {active && !booking.enrollmentId && (
            <div id="changer" className="flex flex-col gap-3.5 border-t border-line pt-7">
              {booking.kind === "event" ? (
                <Reschedule
                  slug={slug}
                  bookingId={booking.id}
                  timezone={tz}
                  title={title}
                  reschedule={reschedule}
                  cancel={cancel}
                />
              ) : (
                <div className="flex justify-end">{cancel}</div>
              )}
            </div>
          )}
        </div>
      </section>
      <SpaceAside eyebrow={title} image={booking.eventCoverImageUrl ?? workspace.coverImageUrl}>
        {booking.eventDescription
          ? truncate(booking.eventDescription, 220)
          : `Réservation ${booking.reference} chez ${workspace.name}.`}
      </SpaceAside>
    </div>
  );
}

/** Lot 30 : la séance fait partie d'une inscription au trimestre (progression, paiement, absence). */
function Enrollment({
  enrollment,
  timezone,
  absence,
}: {
  enrollment: NonNullable<Data["enrollment"]>;
  timezone: string;
  absence: ReactNode;
}) {
  const { payment } = enrollment;
  return (
    <div className="flex flex-col gap-3.5 border-t border-line pt-7">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold leading-6 text-ink">Ton inscription au trimestre</h2>
        <p className="text-sm leading-5 text-ink-muted">
          Un empêchement ? Signale ton absence : ta place profite à quelqu'un d'autre, ton
          inscription continue pour les autres séances.
        </p>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
        <EnrollmentProgress progress={enrollment.progress} timeZone={timezone} />
        <div className="flex flex-1 flex-col items-start justify-between gap-3">
          {payment && (
            <p className="flex items-center gap-2.5 text-[15px] font-semibold text-ink">
              {formatMoney(enrollment.amountCents)}
              <StatusBadge tone={payment.tone}>{payment.label}</StatusBadge>
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {payment?.payUrl && (
              <ButtonLink
                href={payment.payUrl}
                target="_blank"
                rel="noreferrer"
                variant="brand"
                size="sm"
              >
                Payer {formatMoney(enrollment.amountCents)} ↗
              </ButtonLink>
            )}
            {absence}
          </div>
        </div>
      </div>
    </div>
  );
}

const truncate = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, "")}…` : text;

/** « Ajouter à mon agenda » : Google Agenda, ou le fichier .ics (Apple Calendrier, Outlook). */
function AgendaButton({ ics, google }: { ics: string; google: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="lg" onClick={() => setOpen(true)}>
        Ajouter à mon agenda
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Ajouter à mon agenda"
        description="Pour tous tes cours d'un coup, abonne-toi plutôt à ton agenda depuis l'accueil de ton espace."
        footer={
          <>
            <a
              href={google}
              target="_blank"
              rel="noreferrer"
              className={buttonClasses({ variant: "secondary" })}
            >
              Google Agenda
            </a>
            <a href={ics} download className={buttonClasses({ variant: "secondary" })}>
              Apple Calendrier ou Outlook
            </a>
          </>
        }
      />
    </>
  );
}

/** Changer de date : les autres dates du même type qui ont des places, puis « Passer au … ». */
function Reschedule({
  slug,
  bookingId,
  timezone,
  title,
  reschedule,
  cancel,
}: {
  slug: string;
  bookingId: string;
  timezone: string;
  title: string;
  reschedule: Data["reschedule"];
  /** « Annuler ma réservation », sur la ligne du bouton (maquette 8.3). */
  cancel: ReactNode;
}) {
  const router = useRouter();
  const { options, closed, deadline } = reschedule;
  const [chosen, setChosen] = useState(options[0]?.id ?? null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "danger" | "success"; text: string } | null>(null);
  const option = options.find((entry) => entry.id === chosen);
  const label = (entry: (typeof options)[number]) =>
    cardDate(entry.startsAt, entry.endsAt, timezone);
  const until =
    deadline &&
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: timezone,
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
    }).format(deadline);

  // Aucune autre date possible : une ligne discrète, pas de section vide.
  if (closed || options.length === 0)
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-5 text-ink-muted">
          {closed ?? `Pas d'autre date de « ${title} » possible pour l'instant.`}
        </p>
        {cancel}
      </div>
    );

  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold leading-6 text-ink">Changer de date</h2>
        <p className="text-sm leading-5 text-ink-muted">
          Possible jusqu'au {until}, sans frais. Ta place actuelle est libérée pour quelqu'un
          d'autre.
          {options.some((entry) => entry.deltaCents !== 0) &&
            " Si le tarif change, la différence reste à payer ; en cas de trop-perçu, l'organisateur te rembourse."}
        </p>
      </div>
      {message && <FormAlert tone={message.tone}>{message.text}</FormAlert>}
      <div
        role="radiogroup"
        aria-label="Nouvelle date"
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
      >
        {options.map((entry) => (
          <label
            key={entry.id}
            className={cn(
              "flex cursor-pointer flex-col gap-0.5 rounded-2xl border bg-surface px-4 py-3.5 press hover:bg-field",
              "has-checked:border-[1.5px] has-checked:border-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink",
              "border-line",
            )}
          >
            <input
              type="radio"
              name="date"
              value={entry.id}
              checked={chosen === entry.id}
              onChange={() => setChosen(entry.id)}
              className="sr-only"
            />
            <span className="text-[15px] font-semibold leading-5 text-ink">{label(entry)}</span>
            {entry.deltaCents !== 0 && (
              <span className="text-[13px] leading-[18px] text-ink-muted">
                {entry.deltaCents > 0
                  ? `${formatMoney(entry.deltaCents)} de plus`
                  : `${formatMoney(-entry.deltaCents)} de moins`}
              </span>
            )}
            <span
              className={cn(
                "text-[13px] leading-[18px]",
                entry.remaining !== null && entry.remaining <= 1 ? "text-warning" : "text-success",
              )}
            >
              {entry.remaining === null
                ? "Places libres"
                : entry.remaining === 1
                  ? "Plus qu'une place"
                  : `${plural(entry.remaining, "place libre", "places libres")}`}
            </span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1.5">
        {option ? (
          <Button
            pending={pending}
            onClick={async () => {
              setPending(true);
              const result = await rescheduleCustomerBookingAction(slug, bookingId, option.id);
              setPending(false);
              setMessage(
                result.error
                  ? { tone: "danger", text: result.error }
                  : { tone: "success", text: result.success ?? "C'est fait." },
              );
              router.refresh();
            }}
          >
            Passer au {label(option)}
          </Button>
        ) : (
          <span />
        )}
        {cancel}
      </div>
    </>
  );
}
