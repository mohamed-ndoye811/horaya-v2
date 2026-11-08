import { acceptsGiftCards, cancellationPolicyOf, depositLabel } from "@horaya/core";
import { CountUp } from "@/components/motion/count-up";
import { eventCover } from "@/components/public/public-events";
import { NotFoundScreen } from "@/components/public/public-not-found";
import { ArrowLeft } from "@/components/ui/icons";
import type { getBookEventPage } from "@/functions/public";
import { cn } from "@/lib/cn";
import { BOOKING_NOUN_LABELS } from "@/lib/fields";
import { displayFontClass } from "@/lib/fonts";
import { formatEventRange, formatMoney } from "@/lib/format";
import { Link } from "@/lib/navigation";
import { bookingState, cancellationPolicy, paymentNote } from "@/lib/public-booking";
import { withParams } from "@/lib/search-params";
import { BookingForm } from "./booking-form";
import { PriceLines, usePriceChoice } from "./price-choice";

/** Maquette 5.3 : coordonnées des participants et paiement (complet ou clos : redirigé avant). */
export function BookEventPage({
  eventSlug,
  data: { workspace, event, linkSlug, channel, now, seats, prefill, pass, equipment },
}: {
  eventSlug: string;
  data: Awaited<ReturnType<typeof getBookEventPage>>;
}) {
  const slug = workspace.slug;
  // Tarifs et options : le total suit chaque choix (même calcul que le serveur).
  const price = usePriceChoice(event ?? { priceCents: 0, paymentMode: "free", modules: {} }, seats);
  if (!event) {
    return (
      <NotFoundScreen
        wordmark={false}
        title="Cet événement a quitté l'agenda."
        primary={{
          label: "Voir les événements à venir",
          href: linkSlug ? `/${slug}/calendrier/${linkSlug}` : `/${slug}`,
        }}
      />
    );
  }
  const state = bookingState(event, now);
  const eventHref = withParams(`/${slug}/${eventSlug}`, { lien: linkSlug ?? undefined });
  const total = price.quote.amountCents;
  const policy =
    event.paymentMode === "free"
      ? null
      : cancellationPolicy(
          event.startsAt,
          cancellationPolicyOf(event.modules, workspace),
          workspace.timezone,
        );
  const depositCents = price.quote.depositCents;
  const depositModule = event.modules.deposit;
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
          : BOOKING_NOUN_LABELS[event.bookingNoun].confirm;

  const place = event.locationName ?? (event.online ? "En ligne" : null);
  const deposit = depositCents !== null && total > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex animate-rise flex-col gap-1.5">
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
          {BOOKING_NOUN_LABELS[event.bookingNoun].title}
        </h1>
      </div>

      <BookingForm
        slug={slug}
        eventSlug={eventSlug}
        linkSlug={linkSlug}
        seats={seats}
        fields={event.fields}
        workspaceName={workspace.name}
        submitLabel={submitLabel}
        prefill={prefill}
        pass={pass}
        equipment={equipment}
        price={price.visible ? price : null}
        giftCards={acceptsGiftCards(event.modules.payment_methods)}
        payment={
          paysOnline && channel
            ? {
                kind: channel.kind,
                organization: workspace.name,
                due: formatMoney(dueNow),
                deposit: event.paymentMode === "deposit",
                rest: formatMoney(total - dueNow),
                restLater: depositModule?.balance === "later",
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
              style={eventCover(event.coverImageUrl, event.id)}
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
                    {!price.visible &&
                      event.priceCents > 0 &&
                      ` × ${formatMoney(event.priceCents)}`}
                    <Link
                      href={`${eventHref}#reserver`}
                      className="ml-2 text-[13px] font-semibold text-ink-subtle underline underline-offset-2 hover:text-ink"
                    >
                      Modifier
                    </Link>
                  </span>
                  {!price.visible && (
                    <span className="font-semibold text-ink">
                      {total > 0 ? formatMoney(total) : "Gratuit"}
                    </span>
                  )}
                </p>
                {price.visible && <PriceLines lines={price.quote.lines} />}
                <p className="flex items-baseline justify-between gap-4">
                  <span className="text-[15px] font-bold leading-5 text-ink">Total TTC</span>
                  <span className="text-xl font-semibold leading-6 text-ink">
                    {total > 0 ? <CountUp value={formatMoney(total)} /> : "Gratuit"}
                  </span>
                </p>
              </div>
              {deposit ? (
                <div className="flex flex-col gap-2 rounded-[14px] bg-field p-3.5 text-sm leading-[18px]">
                  <p className="flex justify-between gap-4 font-bold text-[var(--brand-text)]">
                    <span>
                      Acompte {depositModule ? depositLabel(depositModule) : ""}
                      {paysOnline ? " · maintenant" : ""}
                    </span>
                    <span>{formatMoney(dueNow)}</span>
                  </p>
                  <p className="flex justify-between gap-4">
                    <span className="text-ink/85">
                      {depositModule?.balance === "later"
                        ? "Reste à régler plus tard"
                        : "Reste sur place"}
                    </span>
                    <span className="font-semibold text-ink">{formatMoney(total - dueNow)}</span>
                  </p>
                </div>
              ) : (
                total > 0 && (
                  <p className="rounded-[14px] bg-field p-3.5 text-sm leading-[18px] text-ink/85">
                    {paymentNote(event.paymentMode, channel, depositModule)}
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
