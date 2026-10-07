import { getPublicEvent } from "@horaya/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BrandBand, PublicNav } from "@/components/public/public-chrome";
import { NotFoundScreen } from "@/components/public/public-not-found";
import { Check } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { displayFontClass } from "@/lib/fonts";
import { formatEventRange, formatMoney } from "@/lib/format";
import { bookingState, cancellationPolicy, paymentNote } from "@/lib/public-booking";
import { param, withParams } from "@/lib/search-params";
import { db } from "@/server/db";
import { getCalendarLink, getWorkspaceBySlug, workspacePaymentChannel } from "@/server/public";
import { BookingForm } from "./booking-form";

export const metadata: Metadata = { title: "Réserver tes places", robots: { index: false } };

/** Écran 18 : coordonnées des participants. */
export default async function BookEventPage({
  params,
  searchParams,
}: PageProps<"/[slug]/[event]/reserver">) {
  const { slug, event: eventSlug } = await params;
  const query = await searchParams;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  const link = await getCalendarLink(workspace.id, param(query.lien));
  const event = await getPublicEvent(db, workspace.id, eventSlug, link);
  if (!event) {
    return (
      <NotFoundScreen
        wordmark={false}
        title="Cet événement a quitté l'agenda."
        primary={{
          label: "Voir les événements à venir",
          href: link ? `/${slug}/calendrier/${link.slug}` : `/${slug}`,
        }}
      />
    );
  }
  const state = bookingState(event, new Date());
  const eventHref = withParams(`/${slug}/${eventSlug}`, { lien: link?.slug });
  if (state.kind === "full" || state.kind === "closed") redirect(eventHref);
  const requested = Number(param(query.places) ?? 1);
  const seats = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), state.maxSeats) : 1;
  const total = event.priceCents * seats;
  const policy =
    event.paymentMode === "free"
      ? null
      : cancellationPolicy(event.startsAt, workspace, workspace.timezone);
  const depositCents =
    event.paymentMode === "deposit" && event.depositPercent !== null
      ? Math.round((total * event.depositPercent) / 100)
      : null;
  const channel = workspacePaymentChannel(workspace, event.paymentMode, event.paymentLinkUrl);
  // Paiement en ligne juste après : réservation confirmée d'office (ni validation ni liste d'attente).
  const paysOnline =
    channel !== null && state.kind === "open" && !event.requiresApproval && total > 0;
  const payNow = paysOnline && channel?.kind === "stripe";
  const dueNow = event.paymentMode === "deposit" ? (depositCents ?? total) : total;
  const submitLabel =
    state.kind === "waitlist"
      ? "Rejoindre la liste d'attente"
      : event.requiresApproval
        ? "Envoyer ma demande"
        : payNow
          ? event.paymentMode === "deposit"
            ? `Payer l'acompte de ${formatMoney(dueNow)}`
            : `Payer ${formatMoney(dueNow)}`
          : "Confirmer ma réservation";

  return (
    <>
      <BrandBand>
        <PublicNav workspace={workspace} />
        <div className="flex flex-col gap-6 px-5 pt-7 pb-7 sm:flex-row sm:items-end sm:justify-between sm:px-16 sm:pt-9 sm:pb-8">
          <div className="flex flex-col gap-2.5">
            <Link
              href={eventHref}
              className="font-mono text-label font-semibold uppercase tracking-[0.055em] opacity-85 hover:underline"
            >
              ← Retour à l'événement
            </Link>
            <h1
              className={cn(
                "text-[40px] leading-10 sm:text-[56px] sm:leading-[52px]",
                displayFontClass(workspace.displayFont),
              )}
            >
              Réserver tes places
            </h1>
          </div>
          <ol className="flex items-center gap-3 text-sm">
            <li className="flex items-center gap-2 opacity-85">
              <span
                aria-hidden="true"
                className="flex size-7 items-center justify-center border-[1.5px] border-[var(--on-brand)]"
              >
                <Check size={12} />
              </span>
              <Link href={eventHref} className="font-semibold hover:underline">
                Places
              </Link>
            </li>
            <li aria-hidden="true" className="h-[1.5px] w-8 bg-[var(--on-brand)] opacity-50" />
            <li aria-current="step" className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="flex size-7 items-center justify-center bg-[var(--on-brand)] font-mono text-[13px] font-bold text-[var(--brand)]"
              >
                2
              </span>
              <span className="font-extrabold">Coordonnées</span>
            </li>
          </ol>
        </div>
      </BrandBand>

      <BookingForm
        slug={slug}
        eventSlug={eventSlug}
        linkSlug={link?.slug ?? null}
        seats={seats}
        customFields={event.customFields}
        workspaceName={workspace.name}
        submitLabel={submitLabel}
        payment={
          paysOnline && channel
            ? {
                kind: channel.kind,
                organization: workspace.name,
                due: formatMoney(dueNow),
                deposit: event.paymentMode === "deposit",
                rest: formatMoney(total - dueNow),
              }
            : null
        }
        summary={
          <>
            <div className="flex flex-col gap-2 bg-[var(--brand)] px-6 py-5 text-[var(--on-brand)]">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.66px] opacity-85">
                Ta réservation
              </p>
              <p
                className={cn(
                  "text-[30px] leading-[30px]",
                  displayFontClass(workspace.displayFont),
                )}
              >
                {event.title}
              </p>
              <p className="text-sm font-semibold">
                {formatEventRange(event.startsAt, event.endsAt, workspace.timezone)}
              </p>
            </div>
            <div className="flex flex-col gap-3 border-b border-line-soft px-6 py-5">
              <p className="flex justify-between gap-4 text-[15px] font-semibold text-ink">
                <span>
                  {seats} × place
                  <Link
                    href={`${eventHref}#reserver`}
                    className="ml-2 text-[13px] font-bold underline decoration-1 underline-offset-[3px]"
                  >
                    Modifier
                  </Link>
                </span>
                <span className="font-mono">{formatMoney(total)}</span>
              </p>
              <p className="flex justify-between gap-4 text-sm font-medium text-ink-muted">
                <span>Paiement</span>
                <span>{paymentNote(event.paymentMode, channel, event.depositPercent)}</span>
              </p>
            </div>
            <div className="flex items-baseline justify-between px-6 pt-5 pb-1">
              <span className="text-[15px] font-bold text-ink">Total TTC</span>
              <span className="font-headline text-[40px] leading-10 text-ink">
                {total > 0 ? formatMoney(total) : "Gratuit"}
              </span>
            </div>
            {(policy || state.kind === "waitlist" || event.requiresApproval) && (
              <p className="order-last -mt-3 px-6 pb-6 text-center text-[13px] font-medium leading-[18px] text-ink-muted">
                {state.kind === "waitlist"
                  ? "C'est complet : tu passes en liste d'attente et tu es prévenu·e dès qu'une place se libère."
                  : [
                      event.requiresApproval ? "L'organisateur valide chaque demande." : null,
                      policy,
                    ]
                      .filter(Boolean)
                      .join(" ")}
              </p>
            )}
          </>
        }
      />
    </>
  );
}
