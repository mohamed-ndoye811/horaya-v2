import { eventCover } from "@/components/public/public-events";
import { NotFoundScreen } from "@/components/public/public-not-found";
import { ArrowLeft } from "@/components/ui/icons";
import { BookingForm } from "@/features/public/booking-form";
import { createPublicEnrollmentAction, type getEnrollEventPage } from "@/functions/public";
import { cn } from "@/lib/cn";
import { displayFontClass } from "@/lib/fonts";
import { formatDateTimeShort, formatMoney } from "@/lib/format";
import { Link } from "@/lib/navigation";
import { paymentNote } from "@/lib/public-booking";

/** « Inscris-toi pour tout le trimestre » : coordonnées, récapitulatif des séances, un paiement. */
export function EnrollPage({
  eventSlug,
  data: { workspace, event, channel, offer, prefill },
}: {
  eventSlug: string;
  data: Awaited<ReturnType<typeof getEnrollEventPage>>;
}) {
  const slug = workspace.slug;
  if (!event || !offer) {
    return (
      <NotFoundScreen
        wordmark={false}
        title="Ce cours a quitté l'agenda."
        primary={{ label: "Voir les événements à venir", href: `/${slug}` }}
      />
    );
  }
  const { quote } = offer;
  const price = quote.priceCents;
  const count = `${offer.sessions.length} séance${offer.sessions.length > 1 ? "s" : ""}`;
  const place = event.locationName ?? (event.online ? "En ligne" : null);
  // Paiement par le lien externe de l'atelier (le paiement intégré ne couvre pas les inscriptions).
  const link = channel?.kind === "link" && price > 0 ? channel : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Link
          href={`/${slug}/${eventSlug}`}
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
          Inscris-toi au trimestre
        </h1>
      </div>

      <BookingForm
        slug={slug}
        eventSlug={eventSlug}
        linkSlug={null}
        seats={1}
        fields={event.fields}
        workspaceName={workspace.name}
        submitLabel="Confirmer mon inscription"
        enrollment
        prefill={prefill}
        action={createPublicEnrollmentAction.bind(null, slug, eventSlug)}
        payment={
          link
            ? {
                kind: "link",
                organization: workspace.name,
                due: formatMoney(price),
                deposit: false,
                rest: formatMoney(0),
              }
            : null
        }
        recap={{ main: `${count} · ${price > 0 ? formatMoney(price) : "Gratuit"}` }}
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
                  {[count, place].filter(Boolean).join(" · ")}
                </p>
              </div>
              <ol className="flex flex-col gap-1.5 border-t border-bg pt-3.5 text-sm leading-[18px] text-ink/85">
                {offer.sessions.map((session, index) => (
                  <li key={session.id} className="flex gap-3">
                    <span className="w-5 shrink-0 font-mono text-xs leading-[18px] text-ink-subtle">
                      {index + 1}
                    </span>
                    {formatDateTimeShort(session.startsAt, workspace.timezone)}
                  </li>
                ))}
              </ol>
              {quote.prorated && (
                <p className="rounded-[14px] bg-field p-3.5 text-sm font-semibold leading-[18px] text-ink">
                  {quote.remaining} séance{quote.remaining > 1 ? "s" : ""} restante
                  {quote.remaining > 1 ? "s" : ""} sur {quote.total} : {formatMoney(price)} au lieu
                  de {formatMoney(quote.fullCents)}
                </p>
              )}
              <p className="flex items-baseline justify-between gap-4 border-t border-bg pt-3.5">
                <span className="text-[15px] font-bold leading-5 text-ink">Total TTC</span>
                <span className="text-xl font-semibold leading-6 text-ink">
                  {price > 0 ? formatMoney(price) : "Gratuit"}
                </span>
              </p>
              {price > 0 && (
                <p className="rounded-[14px] bg-field p-3.5 text-sm leading-[18px] text-ink/85">
                  {link
                    ? "Un seul paiement pour toutes les séances, via le lien de paiement après l'inscription."
                    : paymentNote(
                        event.paymentMode === "free" ? "on_site" : event.paymentMode,
                        null,
                        undefined,
                      )}
                </p>
              )}
              <p className="text-xs leading-[17px] text-ink-subtle">
                Un empêchement ? Tu signales ton absence depuis ton lien : la place profite à la
                liste d'attente, ton inscription reste.
              </p>
            </div>
          </>
        }
      />
    </div>
  );
}
