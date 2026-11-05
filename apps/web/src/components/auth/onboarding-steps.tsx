import { HorayaMark } from "@/components/app/logo";
import { Check } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

const STEPS = ["Compte", "Espace", "Paiements"] as const;

/**
 * Progression de l'inscription : Compte → Espace → Paiements. `notch` : dans le notch noir
 * (grand écran), étape en cours en pilule claire ; sinon au-dessus du formulaire.
 */
export function OnboardingSteps({
  current,
  variant = "page",
}: {
  current: 1 | 2 | 3;
  variant?: "page" | "notch";
}) {
  const notch = variant === "notch";
  return (
    <div className="flex items-center gap-3">
      {notch && (
        <>
          <HorayaMark size={20} />
          <span aria-hidden="true" className="h-5 w-px bg-on-ink/20" />
        </>
      )}
      <ol className="flex flex-wrap items-center gap-2" aria-label="Étapes de l'inscription">
        {STEPS.map((label, index) => {
          const step = index + 1;
          const done = step < current;
          const active = step === current;
          return (
            <li key={label} className="flex items-center gap-2">
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-0.5 w-4 rounded-full",
                    notch
                      ? step <= current
                        ? "bg-on-ink"
                        : "bg-on-ink/25"
                      : step <= current
                        ? "bg-ink"
                        : "bg-line",
                  )}
                />
              )}
              <span
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex h-8 items-center gap-2 rounded-full",
                  active && (notch ? "bg-white/15 pr-3 pl-1" : "bg-ink pr-3 pl-1"),
                )}
              >
                <span
                  className={cn(
                    "flex size-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                    done && "bg-success text-white",
                    active && (notch ? "bg-on-ink text-ink" : "bg-on-ink text-ink"),
                    !done &&
                      !active &&
                      (notch
                        ? "border-[1.5px] border-on-ink/40 text-on-ink/60"
                        : "border-[1.5px] border-ink-subtle text-ink-subtle"),
                  )}
                >
                  {done ? <Check size={12} /> : step}
                </span>
                <span
                  className={cn(
                    "text-[13px] leading-4",
                    active
                      ? "font-semibold text-on-ink"
                      : done
                        ? notch
                          ? "font-medium text-on-ink"
                          : "font-semibold text-ink"
                        : notch
                          ? "font-medium text-on-ink/60"
                          : "font-medium text-ink-subtle",
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
    </div>
  );
}
