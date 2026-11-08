import type { FieldDefinition, FieldValues } from "@horaya/core";
import { answerRows } from "@/lib/fields";

/** Réponses ou informations en lecture (« Niveau · Confirmé »), dans l'ordre des champs. */
export function FieldAnswers({
  fields,
  values,
  timeZone,
}: {
  fields: FieldDefinition[];
  values: FieldValues;
  timeZone?: string;
}) {
  const rows = answerRows(fields, values, timeZone);
  if (rows.length === 0) return null;
  return (
    <dl className="flex flex-col gap-2">
      {rows.map((row) => (
        <div
          key={row.key}
          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5"
        >
          <dt className="text-[13px] leading-[18px] text-ink-muted">{row.label}</dt>
          <dd className="text-sm font-semibold leading-[18px] text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Réponses d'une inscription : questions « une fois », puis un bloc par participant qui a
 * répondu. Rien si aucune réponse.
 */
export function BookingAnswers({
  fields,
  answers,
  participants,
  timeZone,
}: {
  /** Tous les champs de l'événement : les anciennes réponses gardent leur libellé. */
  fields: FieldDefinition[];
  answers: FieldValues;
  participants: Array<{ firstName: string; lastName: string; answers: FieldValues }>;
  timeZone?: string;
}) {
  const answered = participants
    .map((participant, index) => ({ participant, index }))
    .filter(({ participant }) => Object.keys(participant.answers).length > 0);
  if (Object.keys(answers).length === 0 && answered.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      <FieldAnswers fields={fields} values={answers} timeZone={timeZone} />
      {answered.map(({ participant, index }) => (
        <div key={index} className="flex flex-col gap-2 border-t border-line-faint pt-3">
          <p className="text-[13px] font-bold leading-4 text-ink">
            {`${participant.firstName} ${participant.lastName}`.trim() ||
              `Participant ${index + 1}`}
          </p>
          <FieldAnswers fields={fields} values={participant.answers} timeZone={timeZone} />
        </div>
      ))}
    </div>
  );
}
