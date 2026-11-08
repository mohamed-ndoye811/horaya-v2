import type { Rate } from "@horaya/core";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { cardShellClasses } from "@/components/ui/section";
import { cn } from "@/lib/cn";
import {
  formatDayNumber,
  formatMoney,
  formatMonthShort,
  formatTimeRange,
  formatWeekdayShort,
} from "@/lib/format";

interface StageSession {
  id: string;
  startsAt: Date;
  endsAt: Date;
  sessionTopic: string | null;
  capacity: number | null;
  seatsHeld: number;
}

/** « Sam. 14 nov. » */
export const sessionDay = (date: Date, timeZone: string) =>
  `${formatWeekdayShort(date, timeZone)} ${formatDayNumber(date, timeZone)} ${formatMonthShort(date, timeZone).toLowerCase()}`;

/** Les séances d'un stage, une ligne chacune : le jour, puis les heures et le sujet. */
export function StageSessionList({
  sessions,
  timeZone,
}: {
  sessions: ReadonlyArray<Pick<StageSession, "id" | "startsAt" | "endsAt" | "sessionTopic">>;
  timeZone: string;
}) {
  return (
    <ol className="flex flex-col gap-1.5">
      {sessions.map((session) => (
        <li key={session.id} className="flex items-baseline gap-2.5 text-[13px] leading-[17px]">
          <span className="w-[84px] shrink-0 font-semibold text-ink">
            {sessionDay(session.startsAt, timeZone)}
          </span>
          <span className="text-ink-muted">
            {[formatTimeRange(session.startsAt, session.endsAt, timeZone), session.sessionTopic]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Maquette 9.7 : la carte publique d'un stage. Ses séances, les places qui restent sur toutes,
 * le prix de tout le stage et « Je m'inscris au stage ». `children` : la séance à l'unité.
 */
export function StageCard({
  title,
  sessions,
  started,
  full,
  priceCents,
  rates,
  prices,
  href,
  timeZone,
  children,
}: {
  title: string;
  sessions: StageSession[];
  /** La première séance est passée : les inscriptions sont closes. */
  started: boolean;
  full: boolean;
  priceCents: number;
  /** Tarifs du stage (noms des séances, prix de la série). */
  rates: Rate[];
  prices: Record<string, number> | null;
  href: string;
  timeZone: string;
  children?: ReactNode;
}) {
  const capacity = sessions[0]?.capacity ?? null;
  const left = sessions.reduce<number | null>(
    (min, session) =>
      session.capacity === null
        ? min
        : Math.min(min ?? Number.POSITIVE_INFINITY, session.capacity - session.seatsHeld),
    null,
  );
  const others = rates.length > 1 && prices ? rates : [];
  return (
    <aside
      id="reserver"
      className={cn(
        cardShellClasses,
        "w-full shrink-0 scroll-mt-20 overflow-hidden lg:sticky lg:top-[62px] lg:w-[400px]",
      )}
    >
      <div className="flex flex-col gap-1 bg-[var(--brand,var(--color-ink))] p-[18px] text-[var(--on-brand,#ffffff)]">
        <p className="text-[11px] font-bold uppercase leading-[14px] tracking-[0.06em] opacity-80">
          Stage · {sessions.length} séance{sessions.length > 1 ? "s" : ""}
        </p>
        <p className="text-xl font-semibold leading-6">{title}</p>
      </div>
      <div className="flex flex-col gap-3 px-[18px] pt-4 pb-[18px]">
        <StageSessionList sessions={sessions} timeZone={timeZone} />
        <div aria-hidden="true" className="h-px shrink-0 bg-line-soft" />
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[13px] leading-[17px] text-ink-muted">
            {left === null
              ? "Toutes les séances"
              : `${Math.max(left, 0)} place${left > 1 ? "s" : ""} sur ${capacity} · toutes les séances`}
          </p>
          <p className="text-section font-semibold leading-[26px] text-ink">
            {priceCents > 0 ? formatMoney(priceCents) : "Gratuit"}
          </p>
        </div>
        {others.length > 0 && (
          <p className="-mt-2 text-right text-label leading-4 text-ink-muted">
            {others
              .map((rate) => `${rate.name} ${formatMoney(prices?.[rate.id] ?? rate.priceCents)}`)
              .join(" · ")}
          </p>
        )}
        {started ? (
          <p className="text-sm font-semibold leading-5 text-ink-muted">
            Le stage a commencé : les inscriptions sont closes.
          </p>
        ) : full ? (
          <p className="text-sm font-semibold leading-5 text-ink-muted">
            C'est complet : il n'y a plus de place pour tout le stage.
          </p>
        ) : (
          <ButtonLink href={href} variant="brand" arrow>
            Je m'inscris au stage
          </ButtonLink>
        )}
        {children}
      </div>
    </aside>
  );
}
