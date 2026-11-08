import {
  type EventTypeField,
  fieldsOfScope,
  parseFieldValues,
  type Rule,
  submissionOutcome,
} from "@horaya/core";
import { useEffect, useRef, useState } from "react";
import { Collapse } from "@/components/motion/collapse";
import { rawFieldValues } from "@/lib/fields";
import { FieldInputs } from "./field-inputs";

/**
 * Questions demandées par les règles « si… alors… » (lot 36) : elles apparaissent dès que la
 * condition est vraie d'après ce qui est saisi (réponses `a.` et participants `p0.`, `p1.`…).
 * Les règles arrivent déjà réduites au formulaire (voir formRules) ; ce qui reste inconnu, comme
 * le client, compte comme vrai. Le serveur revérifie tout et n'exige que les vraies.
 */
export function RuleQuestions({
  rules,
  fields,
  seats,
  errors = {},
  enforceRequired = true,
  title,
}: {
  rules: Rule[];
  fields: EventTypeField[];
  seats: number;
  errors?: Record<string, string>;
  enforceRequired?: boolean;
  title?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [asked, setAsked] = useState<EventTypeField[]>([]);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form || rules.length === 0) return;
    const update = () => {
      const data = new FormData(form);
      const now = new Date();
      const parse = (scope: "booking" | "participant", prefix: string) =>
        parseFieldValues(fieldsOfScope(fields, scope), rawFieldValues(data, prefix), {
          now,
          enforceRequired: false,
        }).values;
      const facts = {
        booking: {
          answers: parse("booking", "a."),
          participants: Array.from({ length: seats }, (_, index) => ({
            answers: parse("participant", `p${index}.`),
          })),
        },
      };
      const next = submissionOutcome(rules, fields, facts, true).asked;
      setAsked((current) =>
        current.map((field) => field.key).join() === next.map((field) => field.key).join()
          ? current
          : next,
      );
    };
    update();
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    return () => {
      form.removeEventListener("input", update);
      form.removeEventListener("change", update);
    };
  }, [rules, fields, seats]);

  return (
    <div ref={ref}>
      <Collapse open={asked.length > 0}>
        <div className="flex flex-col gap-3.5 rounded-[18px] bg-field p-[18px]">
          {title && <p className="text-sm font-bold leading-[18px] text-ink">{title}</p>}
          <FieldInputs
            fields={asked}
            prefix="a."
            errorPrefix="answers."
            errors={errors}
            enforceRequired={enforceRequired}
            className="grid gap-3 sm:grid-cols-2"
          />
        </div>
      </Collapse>
    </div>
  );
}
