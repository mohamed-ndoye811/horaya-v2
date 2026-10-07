import { Check } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

const STEPS = ["Compte", "Espace", "Paiements"] as const;

/** Progression de l'inscription : Compte → Espace → Paiements. */
export function OnboardingSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="flex flex-wrap items-center gap-2.5" aria-label="Étapes de l'inscription">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;
        return (
          <li key={label} className="flex items-center gap-2.5">
            {index > 0 && (
              <span
                aria-hidden="true"
                className={cn("h-0.5 w-6", step <= current ? "bg-ink" : "bg-line-soft")}
              />
            )}
            <span className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center font-mono text-label font-bold",
                  done && "bg-success text-white",
                  active && "bg-ink text-on-ink",
                  !done && !active && "border-2 border-ink-subtle text-ink-subtle",
                )}
              >
                {done ? <Check /> : step}
              </span>
              <span
                className={cn(
                  "text-[13px] leading-4",
                  done && "font-bold text-success",
                  active && "font-bold text-ink",
                  !done && !active && "font-semibold text-ink-subtle",
                )}
              >
                {label}
                {done && <span className="sr-only"> (terminé)</span>}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
