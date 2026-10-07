import type { ReactNode } from "react";

/**
 * État vide : rangée de cases (pleines, la case « + », puis en pointillés), grand titre,
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
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 py-16 sm:py-24">
      <div className="flex gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span key={`plein-${index}`} className="size-10 border-2 border-ink sm:size-14" />
        ))}
        <span className="flex size-10 items-center justify-center bg-ink text-2xl font-bold text-on-ink sm:size-14">
          +
        </span>
        {[0, 1, 2].map((index) => (
          <span
            key={`vide-${index}`}
            className="size-10 border-[1.5px] border-dashed border-ink-subtle sm:size-14"
          />
        ))}
      </div>
      <h2 className="font-headline text-[44px] leading-[42px] text-ink sm:text-display sm:leading-[60px]">
        {title}
      </h2>
      <p className="max-w-[560px] text-lg font-medium leading-7 text-ink-muted">{description}</p>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      {steps && (
        <ol className="mt-4 grid border-t-2 border-ink sm:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step}
              className="flex flex-col gap-1.5 border-line-soft py-4 sm:pr-4 sm:[&:not(:first-child)]:border-l sm:[&:not(:first-child)]:pl-4"
            >
              <span className="font-mono text-label font-semibold text-ink-muted">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-[15px] font-bold leading-5 text-ink">{step}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
