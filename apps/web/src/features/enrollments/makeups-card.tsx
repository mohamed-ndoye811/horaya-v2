import { useState, useTransition } from "react";
import { Collapse } from "@/components/motion/collapse";
import { PresenceItem, PresenceList } from "@/components/motion/presence";
import { Swap } from "@/components/motion/swap";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import {
  bookCustomerMakeupAction,
  cancelCustomerAbsenceAction,
  type getMyMakeups,
} from "@/functions/customer-space";
import { formatDateTimeShort } from "@/lib/format";
import { Link, useRouter } from "@/lib/navigation";
import { CancelAbsenceButton } from "./enrollment-progress";

type Makeup = Awaited<ReturnType<typeof getMyMakeups>>[number];

/**
 * « Séances à rattraper » de l'espace client : une absence signalée à temps se rattrape sur une
 * autre séance du même cours, avant la fin du trimestre et dans la limite des places.
 */
export function MakeupsCard({
  slug,
  makeups,
  now,
  timeZone,
}: {
  slug: string;
  makeups: Makeup[];
  now: Date;
  timeZone: string;
}) {
  if (makeups.length === 0) return null;
  const waiting = makeups.filter((makeup) => makeup.state === "available").length;
  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 sm:p-7">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold leading-6 text-ink">Séances à rattraper</h2>
        <p className="text-sm leading-5 text-ink-muted">
          <Swap value={String(waiting)}>
            {waiting === 0
              ? "Tout est rattrapé."
              : `${waiting} séance${waiting > 1 ? "s" : ""} à rattraper avant la fin du trimestre.`}
          </Swap>
        </p>
      </div>
      <div className="relative flex flex-col">
        <PresenceList>
          {makeups.map((makeup) => (
            <PresenceItem
              key={makeup.absentBookingId}
              className="border-t border-line py-3.5 first:border-t-0 first:pt-0 last:pb-0"
            >
              <MakeupRow slug={slug} makeup={makeup} now={now} timeZone={timeZone} />
            </PresenceItem>
          ))}
        </PresenceList>
      </div>
    </section>
  );
}

function MakeupRow({
  slug,
  makeup,
  now,
  timeZone,
}: {
  slug: string;
  makeup: Makeup;
  now: Date;
  timeZone: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const book = (eventId: string) =>
    startTransition(async () => {
      const result = await bookCustomerMakeupAction(slug, makeup.absentBookingId, eventId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="flex flex-col gap-0.5">
          <span className="text-ui font-semibold leading-5 text-ink">
            {formatDateTimeShort(makeup.absentStartsAt, timeZone)}
          </span>
          <span className="text-meta leading-4 text-ink-muted">{makeup.absentTitle}</span>
        </p>
        <Swap value={makeup.state}>
          <StatusBadge
            tone={
              makeup.state === "available" ? "info" : makeup.state === "used" ? "success" : "draft"
            }
          >
            {makeup.state === "available"
              ? "À rattraper"
              : makeup.state === "used"
                ? "Rattrapée"
                : "Rattrapage échu"}
          </StatusBadge>
        </Swap>
      </div>
      {makeup.state === "used" && makeup.usedStartsAt && (
        <p className="text-meta leading-[18px] text-ink-muted">
          Rattrapée le {formatDateTimeShort(makeup.usedStartsAt, timeZone)}
          {makeup.usedBookingId && (
            <>
              {" · "}
              <Link
                href={`/${slug}/mon-espace/${makeup.usedBookingId}`}
                className="font-semibold text-ink underline"
              >
                Voir la réservation
              </Link>
            </>
          )}
        </p>
      )}
      {makeup.state === "available" && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="soft"
              size="sm"
              aria-expanded={open}
              onClick={() => {
                setError(null);
                setOpen(!open);
              }}
            >
              <Swap value={open ? "fermer" : "choisir"}>
                {open ? "Fermer" : "Choisir une séance"}
              </Swap>
            </Button>
            {makeup.absentStartsAt > now && (
              <CancelAbsenceButton
                session={{
                  eventId: makeup.absentEventId,
                  title: makeup.absentTitle,
                  startsAt: makeup.absentStartsAt,
                }}
                timeZone={timeZone}
                onCancel={() => cancelCustomerAbsenceAction(slug, makeup.absentBookingId)}
              />
            )}
          </div>
          <Collapse open={open}>
            <div className="flex flex-col gap-2 rounded-2xl bg-bg px-4 py-3">
              {error && <FormAlert>{error}</FormAlert>}
              {makeup.targets.length === 0 ? (
                <p className="text-meta leading-[18px] text-ink-muted">
                  Aucune séance avec une place libre pour l'instant. Reviens voir plus tard.
                </p>
              ) : (
                <ul className="reveal-group flex flex-col">
                  {makeup.targets.map((target) => (
                    <li
                      key={target.id}
                      className="flex items-center justify-between gap-3 border-t border-line py-2.5 first:border-t-0"
                    >
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold leading-[18px] text-ink">
                          {formatDateTimeShort(target.startsAt, timeZone)}
                        </span>
                        <span className="text-meta leading-4 text-ink-muted">
                          {target.capacity === null
                            ? target.title
                            : `${target.title} · ${target.capacity - target.seatsHeld} place${target.capacity - target.seatsHeld > 1 ? "s" : ""}`}
                        </span>
                      </span>
                      <Button size="xs" pending={pending} onClick={() => book(target.id)}>
                        Réserver
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Collapse>
        </>
      )}
    </div>
  );
}
