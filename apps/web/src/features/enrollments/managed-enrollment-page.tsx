import { Swap } from "@/components/motion/swap";
import { stagger, WordsReveal } from "@/components/motion/words";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { inkCardClasses } from "@/components/ui/section";
import { reportAbsenceAction } from "@/functions/public";
import { cn } from "@/lib/cn";
import { displayFontClass } from "@/lib/fonts";
import { formatDateTimeShort, formatMoney } from "@/lib/format";
import type { ManagedEnrollment } from "@/server/enrollments";
import { AbsenceButton, EnrollmentNextSession } from "./enrollment-progress";

/**
 * Lien de gestion d'une inscription à une série (même adresse que « Gérer ma réservation ») :
 * confirmation juste après l'inscription (?nouvelle=1), progression, séances et absences.
 */
export function ManagedEnrollmentPage({
  workspace,
  enrollment,
  token,
  fresh,
  now,
}: {
  workspace: { slug: string; name: string; timezone: string; displayFont: string };
  enrollment: ManagedEnrollment;
  token: string;
  fresh: boolean;
  now: Date;
}) {
  const slug = workspace.slug;
  const tz = workspace.timezone;
  const title = enrollment.sessions[0]?.title ?? "Cours";
  const cancelled = enrollment.cancelledAt !== null;
  const { progress, payment } = enrollment;
  const onAbsent = (eventId: string) => reportAbsenceAction(slug, token, eventId);
  const count = `${progress.total} séance${progress.total > 1 ? "s" : ""}`;

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4">
      <section className={cn(inkCardClasses, "flex flex-col gap-[18px] rounded-3xl p-6 sm:p-8")}>
        <span className="w-fit">
          {cancelled ? (
            <StatusBadge tone="draft">Désinscrit·e</StatusBadge>
          ) : (
            <StatusBadge tone="info">Inscrit·e au trimestre</StatusBadge>
          )}
        </span>
        <h1
          className={cn(
            "text-[36px] leading-10 tracking-[-0.04em] sm:text-[48px] sm:leading-[52px]",
            displayFontClass(workspace.displayFont),
          )}
        >
          <WordsReveal>
            {cancelled ? "Inscription terminée" : fresh ? "Tu es inscrit·e !" : "Ton inscription"}
          </WordsReveal>
        </h1>
        <p
          className="reveal max-w-[620px] text-[17px] leading-[26px] text-on-ink/75"
          style={stagger(3)}
        >
          {cancelled
            ? `${workspace.name} a mis fin à ton inscription à « ${title} ». Les séances à venir sont libérées.`
            : `${fresh ? `Merci ${enrollment.customerFirstName}. ` : ""}Une place t'attend à chacune des ${count} de « ${title} ». Un empêchement ? Signale ton absence ici : ta place profite à quelqu'un d'autre, ton inscription reste.`}
        </p>
        <div className="flex flex-col gap-3.5 pt-1 sm:flex-row sm:items-center">
          {payment?.payUrl && !cancelled && (
            <ButtonLink
              href={payment.payUrl}
              target="_blank"
              rel="noreferrer"
              variant="brand"
              size="xl"
            >
              Payer {formatMoney(enrollment.amountCents)} ↗
            </ButtonLink>
          )}
          {enrollment.customerEmail && (
            <p className="text-sm leading-[18px] text-notch-idle">
              {fresh ? "Récapitulatif envoyé à " : "Envoyé à "}
              <span className="break-all font-semibold text-on-ink">
                {enrollment.customerEmail}
              </span>
            </p>
          )}
        </div>
      </section>

      {!cancelled && (
        <div className="reveal" style={stagger(4)}>
          <EnrollmentNextSession
            next={progress.next}
            progress={progress}
            timeZone={tz}
            courseHref={(eventSlug) => `/${slug}/${eventSlug}`}
            onAbsent={onAbsent}
          />
        </div>
      )}

      <section className="reveal flex flex-col rounded-3xl bg-surface px-6 py-2" style={stagger(5)}>
        <div className="flex h-14 items-center justify-between gap-4">
          <h2 className="text-lg font-semibold leading-[22px] text-ink">Tes séances</h2>
          {payment && (
            <p className="flex items-center gap-2.5 text-[15px] font-semibold text-ink">
              {formatMoney(enrollment.amountCents)}
              <StatusBadge tone={payment.tone}>{payment.label}</StatusBadge>
            </p>
          )}
        </div>
        <ol className="reveal-group flex flex-col">
          {progress.sessions.map((session, index) => (
            <li
              key={session.bookingId}
              className="flex min-h-[52px] flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-bg py-2.5"
            >
              <p className="flex items-baseline gap-3 text-[15px] leading-5">
                <span className="w-6 shrink-0 font-mono text-xs text-ink-subtle">{index + 1}</span>
                <span
                  className={cn(
                    "font-semibold",
                    session.absent || session.state === "done" ? "text-ink-muted" : "text-ink",
                  )}
                >
                  {formatDateTimeShort(session.startsAt, tz)}
                </span>
              </p>
              <Swap value={session.absent ? "absent" : session.status}>
                {session.absent ? (
                  <StatusBadge tone="neutral">Absence signalée</StatusBadge>
                ) : session.status === "cancelled" ? (
                  <StatusBadge tone="draft">Libérée</StatusBadge>
                ) : session.startsAt <= now ? (
                  <span className="text-[13px] font-semibold text-ink-subtle">
                    {session.state === "done" ? "Passée" : "En cours"}
                  </span>
                ) : (
                  !cancelled && (
                    <AbsenceButton session={session} timeZone={tz} onAbsent={onAbsent} size="xs" />
                  )
                )}
              </Swap>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
