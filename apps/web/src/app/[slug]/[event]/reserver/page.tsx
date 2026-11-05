import { getPublicEvent } from "@horaya/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eventCover } from "@/components/public/public-events";
import { NotFoundScreen } from "@/components/public/public-not-found";
import { ArrowLeft } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { displayFontClass } from "@/lib/fonts";
import { formatEventRange, formatMoney } from "@/lib/format";
import { bookingState, cancellationPolicy, paymentNote } from "@/lib/public-booking";
import { param, withParams } from "@/lib/search-params";
import { db } from "@/server/db";
import { getCalendarLink, getWorkspaceBySlug, workspacePaymentChannel } from "@/server/public";
import { BookingForm } from "./booking-form";

export const metadata: Metadata = { title: "Réserver tes places", robots: { index: false } };

/** Maquette 5.3 : coordonnées des participants et paiement. */
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

  const place = event.locationName ?? (event.onlineUrl ? "En ligne" : null);
  const deposit = depositCents !== null && total > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Link
          href={eventHref}
          className="flex w-fit items-center gap-1.5 text-sm font-semibold leading-[18px] text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="size-3.5" />
          {event.title}
        </Link>
        <h1
          className={cn(
            "text-[36px] leading-10 tracking-[-0.035em] text-ink sm:text-kpi sm:leading-[48px]",
            displayFontClass(workspace.displayFont),
          )}
        >
          Réserve tes places
        </h1>
      </div>

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
        recap={{
          main: `${seats} place${seats > 1 ? "s" : ""} · ${total > 0 ? formatMoney(total) : "Gratuit"}`,
          extra:
            state.kind === "waitlist"
              ? "liste d'attente"
              : event.requiresApproval
                ? "sur validation"
                : deposit && paysOnline
                  ? `${formatMoney(dueNow)} d'acompte maintenant`
                  : undefined,
        }}
        summary={
          <>
            <div
              className="h-[150px] shrink-0 bg-cover bg-center"
              style={eventCover(event.coverImageUrl)}
            />
            <div className="flex flex-col gap-3.5 px-[22px] pt-5 pb-[22px]">
              <div className="flex flex-col gap-1">
                <p className="text-lg font-semibold leading-[22px] text-ink">{event.title}</p>
                <p className="text-sm leading-[18px] text-ink-muted">
                  {[formatEventRange(event.startsAt, event.endsAt, workspace.timezone), place]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex flex-col gap-2.5 border-t border-bg pt-3.5">
                <p className="flex justify-between gap-4 text-sm leading-[18px]">
                  <span className="text-ink/85">
                    {seats} place{seats > 1 ? "s" : ""}
                    {event.priceCents > 0 && ` × ${formatMoney(event.priceCents)}`}
                    <Link
                      href={`${eventHref}#reserver`}
                      className="ml-2 text-[13px] font-semibold text-ink-subtle underline underline-offset-2 hover:text-ink"
                    >
                      Modifier
                    </Link>
                  </span>
                  <span className="font-semibold text-ink">
                    {total > 0 ? formatMoney(total) : "Gratuit"}
                  </span>
                </p>
                <p className="flex items-baseline justify-between gap-4">
                  <span className="text-[15px] font-bold leading-5 text-ink">Total TTC</span>
                  <span className="text-xl font-semibold leading-6 text-ink">
                    {total > 0 ? formatMoney(total) : "Gratuit"}
                  </span>
                </p>
              </div>
              {deposit ? (
                <div className="flex flex-col gap-2 rounded-[14px] bg-field p-3.5 text-sm leading-[18px]">
                  <p className="flex justify-between gap-4 font-bold text-[var(--brand-text)]">
                    <span>
                      Acompte {event.depositPercent} %{paysOnline ? " · maintenant" : ""}
                    </span>
                    <span>{formatMoney(dueNow)}</span>
                  </p>
                  <p className="flex justify-between gap-4">
                    <span className="text-ink/85">Reste sur place</span>
                    <span className="font-semibold text-ink">{formatMoney(total - dueNow)}</span>
                  </p>
                </div>
              ) : (
                total > 0 && (
                  <p className="rounded-[14px] bg-field p-3.5 text-sm leading-[18px] text-ink/85">
                    {paymentNote(event.paymentMode, channel, event.depositPercent)}
                  </p>
                )
              )}
              {(policy || state.kind === "waitlist" || event.requiresApproval) && (
                <p className="text-xs leading-[17px] text-ink-subtle">
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
            </div>
          </>
        }
      />
    </div>
  );
}
