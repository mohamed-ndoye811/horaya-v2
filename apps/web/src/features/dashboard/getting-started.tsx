import { cn } from "@/lib/cn";
import { Link } from "@/lib/navigation";
import { CopyPublicLink, TourCard } from "./getting-started-client";

export interface StartStep {
  label: string;
  detail?: string;
  duration?: string;
  href: string;
  done: boolean;
}

/**
 * « Bien démarrer » (maquette 4.7) : tant qu'il n'y a ni événement à venir ni réservation,
 * le tableau de bord montre les étapes restantes, la visite guidée et la page publique.
 */
export function GettingStarted({ steps, slug }: { steps: StartStep[]; slug: string }) {
  const done = steps.filter((step) => step.done).length;
  const current = steps.findIndex((step) => !step.done);
  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <section className="flex min-w-0 flex-1 flex-col gap-[18px] rounded-3xl bg-ink p-6 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <p className="text-[13px] font-semibold leading-4 text-[#9a9ea8]">Bien démarrer</p>
              <h2 className="font-headline text-[28px] leading-8 tracking-[-0.03em] text-white">
                {done} étape{done > 1 ? "s" : ""} sur {steps.length}
              </h2>
            </div>
            <div aria-hidden="true" className="flex w-[220px] gap-1">
              {steps.map((step) => (
                <span
                  key={step.label}
                  className={cn(
                    "h-1.5 flex-1 rounded-full",
                    step.done ? "bg-accent" : "bg-[#2e2e2e]",
                  )}
                />
              ))}
            </div>
          </div>
          <ol className="flex flex-col gap-1.5">
            {steps.map((step, index) => {
              const active = index === current;
              return (
                <li
                  key={step.label}
                  className={cn(
                    "flex items-center gap-3.5 rounded-2xl pl-4",
                    active ? "min-h-16 bg-[#1e1e1e] py-2.5 pr-2.5" : "min-h-14 pr-4",
                  )}
                >
                  {step.done ? (
                    <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-success">
                      <svg
                        aria-hidden="true"
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#fff"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "flex size-[26px] shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold",
                        active
                          ? "border-2 border-accent text-accent"
                          : "border-[1.5px] border-[#3a3a3a] text-ink-subtle",
                      )}
                    >
                      {index + 1}
                    </span>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      className={cn(
                        "text-[15px] leading-5",
                        step.done
                          ? "font-medium text-ink-subtle line-through"
                          : active
                            ? "font-semibold text-white"
                            : "font-medium text-[#d8d8d8]",
                      )}
                    >
                      {step.label}
                    </span>
                    {active && step.detail && (
                      <span className="text-xs leading-4 text-ink-subtle">{step.detail}</span>
                    )}
                  </span>
                  {active ? (
                    <Link
                      href={step.href}
                      className="flex h-10 shrink-0 items-center rounded-full bg-surface px-[18px] text-sm font-semibold text-ink hover:bg-field"
                    >
                      Commencer
                    </Link>
                  ) : (
                    !step.done &&
                    step.duration && (
                      <span className="shrink-0 text-xs text-ink-muted">{step.duration}</span>
                    )
                  )}
                </li>
              );
            })}
          </ol>
        </section>
        <div className="flex w-full flex-col gap-4 lg:w-[420px] lg:shrink-0">
          <TourCard />
          <section className="flex flex-col gap-3.5 rounded-3xl bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold leading-[22px] text-ink">
                Ta page publique
              </h2>
              <span className="flex items-center gap-1.5 text-xs font-bold text-success">
                <span aria-hidden="true" className="size-[7px] rounded-full bg-success" />
                En ligne
              </span>
            </div>
            <div className="flex h-11 items-center justify-between gap-3 rounded-xl border border-[#ededeb] bg-field pr-1.5 pl-3.5">
              <span className="truncate font-mono text-[13px] text-ink">horaya.app/{slug}</span>
              <CopyPublicLink slug={slug} />
            </div>
            <p className="text-[13px] leading-[18px] text-ink-subtle">
              Elle est vide pour l'instant : ton premier événement y apparaîtra.
            </p>
          </section>
        </div>
      </div>
      <p className="flex min-h-[120px] items-center justify-center gap-3 rounded-3xl border-[1.5px] border-dashed border-[#cfcfcb] px-6 text-center text-sm font-medium leading-5 text-ink-subtle">
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          className="shrink-0"
        >
          <path d="M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6" />
        </svg>
        Tes chiffres (réservations, remplissage, encaissé) arriveront avec tes premières
        réservations.
      </p>
    </div>
  );
}
