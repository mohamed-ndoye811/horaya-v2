import { inkCardClasses } from "@/components/ui/section";
import { cn } from "@/lib/cn";

export interface PassBalance {
  id: string;
  name: string;
  remaining: number;
  total: number;
  /** Fin de validité (date ISO ou Date). */
  expiresAt: Date | string;
}

/**
 * Bloc sombre « Ma carte de séances » de l'accueil de l'espace client (maquette 8.2) : séances
 * restantes sur le total, une pastille par séance, date de fin. Autonome : il ne lit rien, le
 * lot 29 lui passe `getMyPassSummary` (functions/passes.ts). Une carte par bloc.
 */
export function PassBalanceCard({
  pass,
  timeZone,
  className,
}: {
  pass: PassBalance;
  timeZone?: string;
  className?: string;
}) {
  const until = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone,
  }).format(new Date(pass.expiresAt));
  // Au-delà de 20 séances, les pastilles ne tiendraient plus : la jauge seule suffit.
  const dots = Math.min(pass.total, 20);
  const filled = Math.round((pass.remaining / Math.max(pass.total, 1)) * dots);
  return (
    <section className={cn(inkCardClasses, "flex flex-col gap-5 rounded-3xl p-7", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-meta font-semibold leading-4 text-[var(--brand-light,var(--color-on-ink-soft))]">
          {pass.name}
        </h2>
        <p className="text-meta leading-4 text-on-ink-muted">valable jusqu'au {until}</p>
      </div>
      <p className="flex items-baseline gap-2.5">
        <span className="text-[56px] font-medium leading-[56px] tracking-[-0.04em] text-on-ink">
          {pass.remaining}
        </span>
        <span className="text-base leading-[22px] text-on-ink">
          séance{pass.remaining > 1 ? "s" : ""} restante{pass.remaining > 1 ? "s" : ""} sur{" "}
          {pass.total}
        </span>
      </p>
      <div
        role="img"
        aria-label={`${pass.remaining} séances restantes sur ${pass.total}`}
        className="flex gap-1.5"
      >
        {Array.from({ length: dots }, (_, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: pastilles identiques, ordre fixe
            key={index}
            className={cn(
              "h-2 flex-1 rounded-full",
              index < filled ? "bg-[var(--brand,var(--color-on-ink))]" : "bg-ink-line",
            )}
          />
        ))}
      </div>
      <p className="text-sm leading-5 text-on-ink-muted">
        Chaque réservation utilise une séance. Une séance annulée à temps te revient.
      </p>
    </section>
  );
}
