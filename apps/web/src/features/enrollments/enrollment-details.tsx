import type { SeriesEnrollmentRow } from "@horaya/db";
import { useState, useTransition } from "react";
import { BookingAnswers } from "@/components/app/field-answers";
import { Collapse } from "@/components/motion/collapse";
import { PresenceItem, PresenceList } from "@/components/motion/presence";
import { Swap } from "@/components/motion/swap";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormAlert } from "@/components/ui/form-alert";
import { assignMakeupAction } from "@/functions/enrollments";
import { formatDateTimeShort } from "@/lib/format";
import { useRouter } from "@/lib/navigation";

export type MakeupTargets = Record<
  string,
  Array<{
    id: string;
    title: string;
    startsAt: Date;
    capacity: number | null;
    seatsHeld: number;
  }>
>;

const MAKEUP_BADGE = {
  available: { label: "À rattraper", tone: "info" },
  used: { label: "Rattrapée", tone: "success" },
  expired: { label: "Rattrapage échu", tone: "draft" },
} as const;

/**
 * Fenêtre d'un·e inscrit·e (équipe) : ses réponses aux questions du type, et ses séances à
 * rattraper, que l'équipe peut attribuer à une autre séance du même type.
 */
export function EnrollmentDetails({
  row,
  targets,
  timeZone,
  onClose,
}: {
  row: SeriesEnrollmentRow;
  targets: MakeupTargets;
  timeZone: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [choosing, setChoosing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const answered =
    row.answers &&
    (Object.keys(row.answers.answers).length > 0 ||
      Object.keys(row.answers.participant).length > 0);
  const assign = (absentBookingId: string, eventId: string) =>
    startTransition(async () => {
      const result = await assignMakeupAction(absentBookingId, eventId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setChoosing(null);
      router.refresh();
    });

  return (
    <Dialog
      open
      onClose={onClose}
      title={row.customerName}
      description="Inscription au trimestre"
      footer={
        <Button variant="secondary" onClick={onClose} className="flex-1">
          Fermer
        </Button>
      }
    >
      <div className="reveal-group flex flex-col gap-5 px-6 pb-4">
        {error && <FormAlert>{error}</FormAlert>}
        {row.answers && answered && (
          <section className="flex flex-col gap-2.5">
            <h3 className="text-sm font-bold leading-[18px] text-ink">Réponses</h3>
            <BookingAnswers
              fields={row.answers.fields}
              answers={row.answers.answers}
              participants={[
                { firstName: row.customerName, lastName: "", answers: row.answers.participant },
              ]}
              timeZone={timeZone}
            />
          </section>
        )}
        <section className="flex flex-col gap-2.5">
          <h3 className="text-sm font-bold leading-[18px] text-ink">Séances à rattraper</h3>
          {row.makeups.length === 0 ? (
            <p className="text-sm leading-5 text-ink-muted">
              Aucune. Une absence signalée dans le délai d'annulation gratuite en donne une.
            </p>
          ) : (
            <div className="relative flex flex-col">
              <PresenceList>
                {row.makeups.map((makeup) => {
                  const badge = MAKEUP_BADGE[makeup.state];
                  const options = targets[makeup.absentBookingId] ?? [];
                  return (
                    <PresenceItem
                      key={makeup.absentBookingId}
                      className="flex flex-col gap-2.5 border-t border-line py-3 first:border-t-0 first:pt-0"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm leading-[18px] text-ink">
                          <span className="font-semibold">
                            {formatDateTimeShort(makeup.absentStartsAt, timeZone)}
                          </span>
                          {makeup.usedStartsAt && (
                            <span className="text-ink-muted">
                              {" → "}
                              {formatDateTimeShort(makeup.usedStartsAt, timeZone)}
                            </span>
                          )}
                        </p>
                        <span className="flex items-center gap-2">
                          <Swap value={makeup.state}>
                            <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                          </Swap>
                          {makeup.state === "available" && (
                            <Button
                              variant="soft"
                              size="xs"
                              aria-expanded={choosing === makeup.absentBookingId}
                              onClick={() =>
                                setChoosing(
                                  choosing === makeup.absentBookingId
                                    ? null
                                    : makeup.absentBookingId,
                                )
                              }
                            >
                              Attribuer
                            </Button>
                          )}
                        </span>
                      </div>
                      <Collapse open={choosing === makeup.absentBookingId}>
                        <ul className="flex flex-col rounded-2xl bg-field px-4 py-1">
                          {options.length === 0 && (
                            <li className="py-3 text-[13px] leading-[18px] text-ink-muted">
                              Aucune séance du même type avec une place libre avant la fin du
                              trimestre.
                            </li>
                          )}
                          {options.map((target) => (
                            <li
                              key={target.id}
                              className="flex items-center justify-between gap-3 border-t border-line py-2.5 first:border-t-0"
                            >
                              <span className="text-sm leading-[18px] text-ink">
                                {formatDateTimeShort(target.startsAt, timeZone)}
                                <span className="text-ink-muted">
                                  {" · "}
                                  {target.capacity === null
                                    ? "places illimitées"
                                    : `${target.capacity - target.seatsHeld} libre${target.capacity - target.seatsHeld > 1 ? "s" : ""}`}
                                </span>
                              </span>
                              <Button
                                size="xs"
                                pending={pending}
                                onClick={() => assign(makeup.absentBookingId, target.id)}
                              >
                                Attribuer ici
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </Collapse>
                    </PresenceItem>
                  );
                })}
              </PresenceList>
            </div>
          )}
        </section>
      </div>
    </Dialog>
  );
}
