import type { SessionState } from "@horaya/core";
import { useState, useTransition } from "react";
import { Swap } from "@/components/motion/swap";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormAlert } from "@/components/ui/form-alert";
import { cn } from "@/lib/cn";
import { formatDateTimeShort, formatTimeRange } from "@/lib/format";
import { useRouter } from "@/lib/navigation";
import type { FormState } from "@/server/form-state";

/**
 * Blocs « Ton trimestre » et « Ton prochain cours » (maquette 8.2 · Mon espace · accueil) :
 * autonomes, ils servent au lien de gestion d'une inscription et à l'espace client (lot 29).
 * Données : `enrollmentProgress` du core sur les séances de `getEnrollment` (@horaya/db).
 */
export interface EnrollmentProgressData {
  total: number;
  current: number;
  absences: number;
  finished: boolean;
  endsAt: Date | null;
  sessions: ReadonlyArray<{ state: SessionState; absent: boolean }>;
}

export interface NextSession {
  eventId: string;
  title: string;
  slug: string;
  startsAt: Date;
  endsAt: Date;
  locationName: string | null;
}

const day = (date: Date, timeZone: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone, ...options }).format(date);

/** « Ton trimestre · séance 8 sur 12 », jauge par séance, absences et fin de la série. */
export function EnrollmentProgress({
  progress,
  timeZone,
  wide = false,
}: {
  progress: EnrollmentProgressData;
  timeZone: string;
  /** Carte à part (colonne de droite) : toute la largeur plutôt que 280 px. */
  wide?: boolean;
}) {
  const absences =
    progress.absences === 0
      ? "Aucune absence signalée"
      : progress.absences === 1
        ? "Une absence signalée"
        : `${progress.absences} absences signalées`;
  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-4 rounded-2xl bg-field px-5 py-[18px]",
        !wide && "sm:w-[280px] sm:shrink-0",
      )}
    >
      <div className="flex flex-col gap-2.5">
        <p className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold leading-[18px] text-ink">Ton trimestre</span>
          <span className="text-[13px] leading-4 text-ink-muted">
            <Swap value={`${progress.finished}${progress.current}`}>
              {progress.finished ? "terminé" : `séance ${progress.current} sur ${progress.total}`}
            </Swap>
          </span>
        </p>
        <span
          role="img"
          aria-label={`Séance ${progress.current} sur ${progress.total}`}
          className="flex gap-1"
        >
          {progress.sessions.map((session, index) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: une case par séance, ordre fixe.
              key={index}
              style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
              className={cn(
                "h-1.5 flex-1 origin-left animate-grow-x rounded-full transition-colors",
                session.state === "done"
                  ? session.absent
                    ? "bg-line-strong"
                    : "bg-[var(--brand)]"
                  : session.state === "current" && !session.absent
                    ? "bg-ink"
                    : "bg-line-strong",
              )}
            />
          ))}
        </span>
      </div>
      <div className="flex flex-col gap-1.5 text-[13px] leading-[18px] text-ink-muted">
        <p>
          <Swap value={absences}>{absences}</Swap>
        </p>
        {progress.endsAt && (
          <p>
            {progress.finished ? "Trimestre terminé le " : "Fin du trimestre le "}
            {day(progress.endsAt, timeZone, { day: "numeric", month: "long" })}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * « Je serai absent·e » : confirme, puis libère la place (elle passe à la liste d'attente).
 * `onAbsent` : l'action du lien de gestion, ou celle de l'espace client.
 */
export function AbsenceButton({
  session,
  timeZone,
  onAbsent,
  size = "sm",
}: {
  session: Pick<NextSession, "eventId" | "title" | "startsAt">;
  timeZone: string;
  onAbsent: (eventId: string) => Promise<FormState>;
  size?: "xs" | "sm";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button variant="secondary" size={size} onClick={() => setOpen(true)}>
        Je serai absent·e
      </Button>
      {open && (
        <Dialog
          open
          onClose={() => setOpen(false)}
          title="Tu seras absent·e ?"
          description={`Ta place du ${formatDateTimeShort(session.startsAt, timeZone)} pour « ${session.title} » est libérée et profite à la liste d'attente. Ton inscription continue pour les autres séances.`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)} className="flex-1">
                Je viendrai
              </Button>
              <Button
                className="flex-1"
                pending={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await onAbsent(session.eventId);
                    if (result.error) {
                      setError(result.error);
                      return;
                    }
                    setOpen(false);
                    router.refresh();
                  })
                }
              >
                Libérer ma place
              </Button>
            </>
          }
        >
          {error ? <FormAlert>{error}</FormAlert> : null}
        </Dialog>
      )}
    </>
  );
}

/**
 * « Annuler mon absence » : confirme, puis reprend la place (si la liste d'attente ne l'a pas
 * prise). `onCancel` : l'action du lien de gestion, ou celle de l'espace client.
 */
export function CancelAbsenceButton({
  session,
  timeZone,
  onCancel,
  size = "sm",
}: {
  session: Pick<NextSession, "eventId" | "title" | "startsAt">;
  timeZone: string;
  onCancel: (eventId: string) => Promise<FormState>;
  size?: "xs" | "sm";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button variant="secondary" size={size} onClick={() => setOpen(true)}>
        Annuler l'absence
      </Button>
      {open && (
        <Dialog
          open
          onClose={() => setOpen(false)}
          title="Finalement, tu viens ?"
          description={`Tu reprends ta place du ${formatDateTimeShort(session.startsAt, timeZone)} pour « ${session.title} », si personne ne l'a prise entre-temps. Le rattrapage que tu n'as pas utilisé disparaît.`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)} className="flex-1">
                Retour
              </Button>
              <Button
                className="flex-1"
                pending={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await onCancel(session.eventId);
                    if (result.error) {
                      setError(result.error);
                      return;
                    }
                    setOpen(false);
                    router.refresh();
                  })
                }
              >
                Reprendre ma place
              </Button>
            </>
          }
        >
          {error ? <FormAlert>{error}</FormAlert> : null}
        </Dialog>
      )}
    </>
  );
}

/** « Ton prochain cours » (date, cours, actions) avec le bloc « Ton trimestre » à droite. */
export function EnrollmentNextSession({
  next,
  progress,
  timeZone,
  courseHref,
  onAbsent,
}: {
  next: NextSession | null;
  progress: EnrollmentProgressData;
  timeZone: string;
  /** Page publique du cours (« Voir le cours »). */
  courseHref: (slug: string) => string;
  onAbsent?: (eventId: string) => Promise<FormState>;
}) {
  if (!next) {
    return (
      <div className="flex flex-col gap-6 rounded-[20px] bg-surface p-6 sm:flex-row sm:items-center">
        <p className="flex-1 text-[15px] leading-[22px] text-ink-muted">
          {progress.finished
            ? "Ton trimestre est terminé. Merci d'être venu·e !"
            : "Pas d'autre séance prévue pour toi dans ce trimestre."}
        </p>
        <EnrollmentProgress progress={progress} timeZone={timeZone} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6 rounded-[20px] bg-surface p-6 sm:flex-row">
      <div className="flex min-w-0 flex-1 gap-6">
        <div className="flex w-24 shrink-0 flex-col items-center justify-center rounded-2xl bg-field py-3.5">
          <span className="text-xs font-bold uppercase leading-4 tracking-[0.06em] text-[var(--brand-text)]">
            {day(next.startsAt, timeZone, { weekday: "long" })}
          </span>
          <span className="text-[40px] font-medium leading-[44px] tracking-[-0.03em] text-ink">
            {day(next.startsAt, timeZone, { day: "numeric" })}
          </span>
          <span className="text-[13px] leading-4 text-ink-muted">
            {day(next.startsAt, timeZone, { month: "long" })}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold leading-4 text-ink-muted">
                Ton prochain cours
              </span>
              <StatusBadge tone="info">Inscrit·e au trimestre</StatusBadge>
            </p>
            <p className="text-[26px] font-semibold leading-8 tracking-[-0.02em] text-ink">
              {next.title}
            </p>
            <p className="text-[15px] leading-[22px] text-ink-muted">
              {[formatTimeRange(next.startsAt, next.endsAt, timeZone), next.locationName]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={courseHref(next.slug)} size="sm">
              Voir le cours
            </ButtonLink>
            {onAbsent && <AbsenceButton session={next} timeZone={timeZone} onAbsent={onAbsent} />}
          </div>
        </div>
      </div>
      <EnrollmentProgress progress={progress} timeZone={timeZone} />
    </div>
  );
}
