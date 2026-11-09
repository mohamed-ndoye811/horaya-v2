import { acceptsGiftCards, cancellationPolicyOf, durationLabel } from "@horaya/core";
import { CountUp } from "@/components/motion/count-up";
import { ArrowLeft } from "@/components/ui/icons";
import { createSlotBookingAction, type getSlotBookPage } from "@/functions/slots";
import { cn } from "@/lib/cn";
import { BOOKING_NOUN_LABELS } from "@/lib/fields";
import { displayFontClass } from "@/lib/fonts";
import { formatEventRange, formatMoney } from "@/lib/format";
import { Link } from "@/lib/navigation";
import { cancellationPolicy, paymentNote } from "@/lib/public-booking";
import { BookingForm } from "./booking-form";
import { PriceLines, usePriceChoice } from "./price-choice";

/** Le formulaire d'un créneau gardé (lot 37) : comme une réservation, l'événement naît à l'envoi. */
export function SlotBookPage({
  data: { workspace, type, hold, priced, prefill, now },
}: {
  data: Awaited<ReturnType<typeof getSlotBookPage>>;
}) {
  const slug = workspace.slug;
  const price = usePriceChoice(priced, hold.seats);
  const total = price.quote.amountCents;
  const minutes = Math.round((hold.endsAt.getTime() - hold.startsAt.getTime()) / 60_000);
  const expired = hold.expiresAt <= now;
  const policy =
    total > 0
      ? cancellationPolicy(
          hold.startsAt,
          cancellationPolicyOf(type.modules, workspace),
          workspace.timezone,
        )
      : null;
  const requiresApproval = Boolean(type.modules.approval);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex animate-rise flex-col gap-1.5">
        <Link
          href={`/${slug}/creneaux/${type.id}`}
          className="flex w-fit items-center gap-1.5 text-sm font-semibold leading-[18px] text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="size-3.5" />
          {type.name}
        </Link>
        <h1
          className={cn(
            "text-[36px] leading-10 tracking-[-0.035em] text-ink sm:text-kpi sm:leading-[48px]",
            displayFontClass(workspace.displayFont),
          )}
        >
          {BOOKING_NOUN_LABELS[type.bookingNoun].title}
        </h1>
      </div>

      <BookingForm
        slug={slug}
        eventSlug=""
        linkSlug={null}
        seats={hold.seats}
        fields={type.fields}
        rules={type.rules}
        workspaceName={workspace.name}
        submitLabel={
          requiresApproval ? "Envoyer ma demande" : BOOKING_NOUN_LABELS[type.bookingNoun].confirm
        }
        prefill={prefill}
        action={createSlotBookingAction.bind(null, slug, hold.id, hold.seats)}
        price={price.visible ? price : null}
        giftCards={acceptsGiftCards(type.modules.payment_methods)}
        payment={null}
        recap={{
          main: `${durationLabel(minutes)} · ${total > 0 ? formatMoney(total) : "Gratuit"}`,
          extra: requiresApproval ? "sur validation" : undefined,
        }}
        summary={
          <div className="flex flex-col gap-3.5 px-[22px] pt-5 pb-[22px]">
            <div className="flex flex-col gap-1">
              <p className="text-lg font-semibold leading-[22px] text-ink">{type.name}</p>
              <p className="text-sm leading-[18px] text-ink-muted">
                {[
                  formatEventRange(hold.startsAt, hold.endsAt, workspace.timezone),
                  hold.staffFirstName ? `avec ${hold.staffFirstName}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="flex flex-col gap-2.5 border-t border-bg pt-3.5">
              {price.visible ? (
                <PriceLines lines={price.quote.lines} />
              ) : (
                <p className="flex justify-between gap-4 text-sm leading-[18px]">
                  <span className="text-ink/85">{durationLabel(minutes)}</span>
                  <span className="font-semibold text-ink">
                    {total > 0 ? formatMoney(total) : "Gratuit"}
                  </span>
                </p>
              )}
              <p className="flex items-baseline justify-between gap-4">
                <span className="text-ui font-bold leading-5 text-ink">Total TTC</span>
                <span className="text-xl font-semibold leading-6 text-ink">
                  {total > 0 ? <CountUp value={formatMoney(total)} /> : "Gratuit"}
                </span>
              </p>
            </div>
            {total > 0 && (
              <p className="rounded-[14px] bg-field p-3.5 text-sm leading-[18px] text-ink/85">
                {paymentNote(priced.paymentMode, null, type.modules.deposit)}
              </p>
            )}
            <p className="text-xs leading-[17px] text-ink-subtle">
              {expired
                ? "Le délai de 10 minutes est passé : le créneau sera revérifié à l'envoi."
                : `Créneau gardé pour toi jusqu'à ${new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: workspace.timezone }).format(hold.expiresAt)}.`}{" "}
              {[requiresApproval ? "L'atelier valide chaque demande." : null, policy]
                .filter(Boolean)
                .join(" ")}
            </p>
          </div>
        }
      />
    </div>
  );
}
