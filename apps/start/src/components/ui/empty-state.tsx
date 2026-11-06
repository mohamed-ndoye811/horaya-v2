import type { ReactNode } from "react";
import { WordsReveal } from "@/components/motion/words";

/**
 * État vide (DA v4) : carte au contour pointillé, pastille « + », titre, explication,
 * actions et trois étapes pour démarrer.
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
    <div className="reveal-group mx-4 flex flex-col items-center gap-4 rounded-3xl border-[1.5px] border-dashed border-[#dcdcd8] bg-band px-6 py-14 text-center sm:py-20">
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-2xl bg-ink text-2xl font-semibold text-on-ink"
      >
        +
      </span>
      <h2 className="max-w-[560px] font-headline text-[28px] leading-8 text-ink sm:text-[32px] sm:leading-9">
        <WordsReveal>{title}</WordsReveal>
      </h2>
      <p className="max-w-[520px] text-[15px] leading-[22px] text-ink-muted">{description}</p>
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
