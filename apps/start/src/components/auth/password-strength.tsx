"use client";

import { checkPassword, type PasswordStrength } from "@horaya/core";
import { Check } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

const STRENGTH_STYLES: Record<PasswordStrength, { bar: string; text: string; label: string }> = {
  faible: { bar: "bg-danger", text: "text-danger", label: "Faible" },
  correct: { bar: "bg-warning", text: "text-warning", label: "Correct" },
  robuste: { bar: "bg-success", text: "text-success", label: "Robuste" },
};

/** Jauge à 4 barres : une par règle respectée. */
export function PasswordMeter({ password }: { password: string }) {
  if (!password) return null;
  const { score, strength } = checkPassword(password);
  const style = STRENGTH_STYLES[strength];
  return (
    <div className="flex items-center gap-2.5" aria-live="polite">
      <div className="flex grow gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={cn("h-1 grow", index < score ? style.bar : "bg-line-soft")}
          />
        ))}
      </div>
      <span className={cn("shrink-0 text-[13px] font-bold leading-4", style.text)}>
        {style.label}
      </span>
    </div>
  );
}

/** Liste des règles, cochées au fil de la saisie. */
export function PasswordChecklist({ password }: { password: string }) {
  const { rules } = checkPassword(password);
  return (
    <ul className="flex flex-col gap-2 border-[1.5px] border-line-soft bg-surface px-4 py-3.5">
      {rules.map((rule) => (
        <li key={rule.id} className="flex items-center gap-2.5">
          <span className="flex size-3.5 shrink-0 items-center justify-center">
            {rule.met ? (
              <Check size={14} className="text-success" />
            ) : (
              <span className="size-3.5 border-2 border-ink-subtle" />
            )}
          </span>
          <span
            className={cn(
              "text-sm font-semibold leading-[18px]",
              rule.met ? "text-ink" : "text-ink-muted",
            )}
          >
            {rule.label}
            {!rule.required && <span className="font-medium text-ink-subtle"> · conseillé</span>}
          </span>
          <span className="sr-only">{rule.met ? "(respecté)" : "(manquant)"}</span>
        </li>
      ))}
    </ul>
  );
}
