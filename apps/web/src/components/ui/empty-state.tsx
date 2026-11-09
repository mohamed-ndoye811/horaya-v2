import type { ReactNode } from "react";
import { WordsReveal } from "@/components/motion/words";

/**
 * État vide (DA v4) : carte au contour pointillé, grand titre qui parle métier (DA, planche 8),
 * explication, actions et trois étapes pour démarrer.
 */
export function EmptyState({
  title,
  description,
  actions,
  steps,
}: {
  title: string;
  description: ReactNode;
  actions?: ReactNode;
  steps?: [string, string, string];
}) {
  return (
    <div className="reveal-group mx-4 flex flex-col items-center gap-4 rounded-3xl border-[1.5px] border-dashed border-line-strong bg-band px-6 py-14 text-center sm:py-20">
      <h2 className="max-w-[720px] font-headline text-title-sm text-balance text-ink sm:text-display sm:leading-[64px]">
        <WordsReveal>{title}</WordsReveal>
      </h2>
      <p className="max-w-[520px] text-ui leading-[22px] text-ink-muted">{description}</p>
      {actions && <div className="flex flex-wrap justify-center gap-3 pt-1">{actions}</div>}
      {steps && (
        <ol className="mt-4 grid w-full max-w-[720px] gap-3 text-left sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step} className="flex items-start gap-3 rounded-2xl bg-surface px-4 py-3.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-field text-xs font-bold text-ink">
                {index + 1}
              </span>
              <span className="text-sm font-semibold leading-5 text-ink">{step}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
