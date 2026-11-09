import { durationLabel, durationTitle } from "@horaya/core";
import { useState } from "react";
import { choiceTileClasses, choiceTileMutedClasses } from "@/components/public/choice-tile";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { ArrowLeft } from "@/components/ui/icons";
import { cardShellClasses } from "@/components/ui/section";
import { type getSlotPage, holdSlotAction } from "@/functions/slots";
import { cn } from "@/lib/cn";
import { displayFontClass } from "@/lib/fonts";
import { formatMoney } from "@/lib/format";
import { Link } from "@/lib/navigation";
import { withParams } from "@/lib/search-params";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";

type Data = Awaited<ReturnType<typeof getSlotPage>>;

const hour = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone }).format(date);
const civil = (key: string) => new Date(`${key}T12:00:00Z`);
const dayPart = (key: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fr-FR", { ...options, timeZone: "UTC" }).format(civil(key));
const names = (list: string[]) =>
  list.length <= 1 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} ou ${list.at(-1)}`;

/**
 * Maquette 9.6 : un type « sur rendez-vous ». L'élève choisit la durée, le jour, l'heure et
 * l'intervenant ; seuls les jours ouverts et les heures libres sont proposés. « Continuer »
 * garde le créneau 10 minutes, le temps du formulaire.
 */
export function SlotPage({ slug, data }: { slug: string; data: Data }) {
  const { workspace, type, days, durationId } = data;
  const tz = workspace.timezone;
  const base = `/${slug}/creneaux/${type.id}`;
  const firstOpen = days.find((day) => day.slots.length > 0)?.date ?? null;
  const [day, setDay] = useState<string | null>(firstOpen);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const { state, onSubmit, pending } = useFormAction<FormState>(
    holdSlotAction.bind(null, slug, type.id),
    {},
  );
  // Le jour affiché suit la semaine (changement de durée ou de semaine : nouvelles données).
  const shown = days.find((entry) => entry.date === day && entry.slots.length > 0)
    ? day
    : firstOpen;
  const slots = days.find((entry) => entry.date === shown)?.slots ?? [];
  const chooseStaff = Boolean(type.slots.chooseStaff) && type.staff.length > 0;
  const visible = slots.filter((slot) => !staffId || slot.staffIds.includes(staffId));
  const chosen = visible.find((slot) => slot.startsAt.toISOString() === startsAt) ?? null;
  const staffShown = type.staff.filter((member) => !chosen || chosen.staffIds.includes(member.id));
  const moments = [...new Set(visible.map((slot) => slot.moment))];
  const duration = type.duration?.options.find((option) => option.id === durationId) ?? null;
  const priceCents = duration?.priceCents ?? type.defaultPriceCents ?? 0;
  const minutes = duration?.minutes ?? type.defaultDurationMinutes ?? 60;
  const withWhom = staffId
    ? type.staff.find((member) => member.id === staffId)?.firstName
    : names((chosen ? staffShown : type.staff).map((member) => member.firstName));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Link
          href={`/${slug}`}
          className="flex w-fit items-center gap-1.5 text-meta leading-4 text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="size-3" />
          Tous les cours
        </Link>
        <h1
          className={cn(
            "text-[34px] leading-10 tracking-[-0.035em] text-ink sm:text-[40px] sm:leading-[44px]",
            displayFontClass(workspace.displayFont),
          )}
        >
          {type.name}
        </h1>
        <p className="text-ui leading-5 text-ink-muted">
          {type.description ||
            (type.duration
              ? "Tu choisis la durée, le jour et l'heure."
              : "Tu choisis le jour et l'heure.")}
        </p>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className={cn(cardShellClasses, "min-w-0 grow px-4 py-2 sm:px-6")}>
          {type.duration && (
            <section className="flex flex-col gap-3 border-b border-bg py-[18px]">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-base font-semibold leading-5 text-ink">Durée</h2>
                {duration && (
                  <p className="text-meta leading-4 text-ink-muted">
                    {durationLabel(duration.minutes)} · {formatMoney(duration.priceCents)}
                  </p>
                )}
              </div>
              <div className="grid gap-2 sm:flex">
                {type.duration.options.map((option) => (
                  <Link
                    key={option.id}
                    href={withParams(base, { duree: option.id, semaine: data.monday })}
                    aria-current={option.id === durationId ? "true" : undefined}
                    className={cn(
                      choiceTileClasses(option.id === durationId),
                      "flex grow basis-0 flex-col gap-0.5 px-3.5 py-2.5",
                    )}
                  >
                    <span className="flex justify-between gap-3 text-ui leading-5">
                      <span className="font-semibold">{option.label}</span>
                      <span>{formatMoney(option.priceCents)}</span>
                    </span>
                    <span
                      className={cn(
                        "text-label leading-4",
                        choiceTileMutedClasses(option.id === durationId),
                      )}
                    >
                      {[
                        option.label === durationLabel(option.minutes)
                          ? null
                          : durationTitle(option).split(" · ")[1],
                        option.label === durationLabel(option.minutes)
                          ? option.description
                          : option.description?.replace(/^./, (first) => first.toLowerCase()),
                      ]
                        .filter(Boolean)
                        .join(", ") || " "}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-3 border-b border-bg py-[18px]">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-base font-semibold leading-5 text-ink">Jour</h2>
              <div className="flex items-center gap-3.5 text-meta font-semibold leading-4">
                {data.previous ? (
                  <Link
                    href={withParams(base, {
                      duree: durationId ?? undefined,
                      semaine: data.previous,
                    })}
                    aria-label="Semaine précédente"
                    className="text-ink"
                  >
                    ‹
                  </Link>
                ) : (
                  <span aria-hidden="true" className="text-ink-faint">
                    ‹
                  </span>
                )}
                <span className="text-ink">
                  Semaine du {dayPart(data.monday, { day: "numeric", month: "long" })}
                </span>
                <Link
                  href={withParams(base, { duree: durationId ?? undefined, semaine: data.next })}
                  aria-label="Semaine suivante"
                  className="text-ink"
                >
                  ›
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {days.map((entry) => {
                const open = entry.slots.length > 0;
                const selected = open && entry.date === shown;
                const label = (
                  <>
                    <span
                      className={cn(
                        "text-[11px] font-semibold uppercase leading-[14px]",
                        open ? choiceTileMutedClasses(selected) : "text-ink-faint",
                      )}
                    >
                      {dayPart(entry.date, { weekday: "short" })}
                    </span>
                    <span
                      className={cn(
                        "text-[17px] leading-[22px]",
                        open ? "font-semibold" : "text-ink-faint",
                      )}
                    >
                      {dayPart(entry.date, { day: "numeric" })}
                    </span>
                    <span aria-hidden="true" className="flex h-1.5 items-center gap-[3px]">
                      {Array.from({ length: Math.min(entry.slots.length, 3) }, (_, index) => (
                        <span
                          // biome-ignore lint/suspicious/noArrayIndexKey: points décoratifs.
                          key={index}
                          className={cn(
                            "size-[5px] rounded-full",
                            selected ? "bg-[var(--on-brand,#ffffff)]" : "bg-ink-subtle",
                          )}
                        />
                      ))}
                    </span>
                  </>
                );
                return open ? (
                  <button
                    key={entry.date}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setDay(entry.date);
                      setStartsAt(null);
                    }}
                    className={cn(
                      choiceTileClasses(selected),
                      "flex flex-col items-center gap-[3px] py-[9px]",
                    )}
                  >
                    {label}
                  </button>
                ) : (
                  <div key={entry.date} className="flex flex-col items-center gap-[3px] py-[9px]">
                    {label}
                  </div>
                );
              })}
            </div>
            {!firstOpen && (
              <p className="text-sm leading-5 text-ink-muted">
                Plus de créneau libre cette semaine : regarde la suivante.
              </p>
            )}
          </section>

          {shown && (
            <section className="grid gap-6 py-[18px] sm:grid-cols-2 sm:gap-7">
              <div className="flex min-w-0 flex-col gap-3">
                <h2 className="flex items-baseline gap-2">
                  <span className="text-base font-semibold leading-5 text-ink">Heure</span>
                  <span className="text-meta leading-4 text-ink-muted">
                    {dayPart(shown, { weekday: "long", day: "numeric", month: "long" })}
                  </span>
                </h2>
                {moments.map((moment) => (
                  <div
                    key={moment}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <span className="w-[110px] shrink-0 text-label leading-4 text-ink-muted">
                      {moment}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {visible
                        .filter((slot) => slot.moment === moment)
                        .map((slot) => {
                          const key = slot.startsAt.toISOString();
                          return (
                            <button
                              key={key}
                              type="button"
                              aria-pressed={key === startsAt}
                              onClick={() => setStartsAt(key)}
                              className={cn(
                                choiceTileClasses(key === startsAt),
                                "w-[76px] py-[9px] text-center text-sm leading-[18px]",
                                key === startsAt && "font-semibold",
                              )}
                            >
                              {hour(slot.startsAt, tz)}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ))}
                {visible.length === 0 && (
                  <p className="text-sm leading-5 text-ink-muted">
                    Aucune heure libre avec cet intervenant ce jour-là.
                  </p>
                )}
              </div>
              {chooseStaff && (
                <div className="flex min-w-0 flex-col gap-3 sm:border-l sm:border-bg sm:pl-7">
                  <h2 className="text-base font-semibold leading-5 text-ink">Avec</h2>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      aria-pressed={staffId === null}
                      onClick={() => setStaffId(null)}
                      className={cn(
                        choiceTileClasses(staffId === null),
                        "flex h-10 items-center px-3.5 text-sm font-semibold leading-[18px]",
                      )}
                    >
                      Peu importe
                    </button>
                    {staffShown.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        aria-pressed={staffId === member.id}
                        onClick={() => setStaffId(member.id)}
                        className={cn(
                          choiceTileClasses(staffId === member.id),
                          "flex h-10 items-center gap-2 pr-3.5 pl-1.5 text-sm font-semibold leading-[18px]",
                        )}
                      >
                        <Avatar name={member.firstName} size="sm" />
                        {member.firstName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        <form
          onSubmit={onSubmit}
          className={cn(
            cardShellClasses,
            "w-full shrink-0 gap-3 p-5 lg:sticky lg:top-[62px] lg:w-[340px]",
          )}
        >
          <input type="hidden" name="startsAt" value={chosen?.startsAt.toISOString() ?? ""} />
          <input type="hidden" name="durationId" value={durationId ?? ""} />
          <input type="hidden" name="staffMemberId" value={staffId ?? ""} />
          <p className="text-label font-bold uppercase leading-4 tracking-[0.06em] text-ink-muted">
            Ton cours
          </p>
          <div className="flex flex-col gap-0.5">
            <p className="text-lg font-semibold leading-[22px] text-ink">
              {chosen
                ? dayPart(shown ?? "", { weekday: "long", day: "numeric", month: "long" }).replace(
                    /^./,
                    (first) => first.toUpperCase(),
                  )
                : "Choisis un créneau"}
            </p>
            <p className="text-ui leading-5 text-ink">
              {chosen
                ? `${hour(chosen.startsAt, tz)} – ${hour(chosen.endsAt, tz)} · ${durationLabel(minutes)}`
                : durationLabel(minutes)}
            </p>
            <p className="text-meta leading-[17px] text-ink-muted">
              {[workspace.name, withWhom ? `avec ${withWhom}` : null].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div aria-hidden="true" className="h-px shrink-0 bg-line-soft" />
          <p className="flex items-baseline justify-between gap-4">
            <span className="text-sm font-semibold leading-[18px] text-ink">Total</span>
            <span className="text-2xl font-semibold leading-7 text-ink">
              {priceCents > 0 ? formatMoney(priceCents) : "Gratuit"}
            </span>
          </p>
          {state.error && <FormAlert>{state.error}</FormAlert>}
          <Button type="submit" variant="brand" arrow disabled={!chosen} pending={pending}>
            Continuer
          </Button>
          <p className="text-label leading-4 text-ink-muted">
            Le créneau t'est gardé 10 minutes pendant que tu remplis le formulaire.
          </p>
        </form>
      </div>
    </div>
  );
}
