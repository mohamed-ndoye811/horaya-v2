import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronRight } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { Link } from "@/lib/navigation";
import { dismissToast, holdToast, type Toast, type ToastTone, useToast } from "@/lib/toast";

/** Couleur vive de chaque ton : la pastille et le halo (maquette Paper « Languette du notch »). */
const GLOW: Record<ToastTone, string> = {
  success: "var(--color-success-vivid)",
  error: "var(--color-danger-vivid)",
  warning: "var(--color-warning-vivid)",
  info: "var(--color-info-vivid)",
};

const SLIDE = { type: "spring", visualDuration: 0.26, bounce: 0 } as const;

/* Courbes en S de la languette du notch (notch.tsx), à 40 px de haut au lieu de 32. */
const EAR_LEFT = "M0 0 C17.5 0 14.5 40 32 40 L33 40 L33 0 Z";
const EAR_RIGHT = "M33 0 C15.5 0 18.5 40 1 40 L0 40 L0 0 Z";

/** Message lu par les lecteurs d'écran ; monté une seule fois (la coque), pas par affichage. */
export function ToastAnnouncer() {
  const current = useToast();
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {current?.message}
    </div>
  );
}

/**
 * Grand écran : languette qui sort de sous le notch, au centre, avec le message. Elle se range
 * pendant qu'un panneau du notch est ouvert. À monter avant le tracé du notch (qui la recouvre).
 */
export function NotchToast({ hidden }: { hidden: boolean }) {
  const current = useToast();
  const reduced = useReducedMotion();
  const shown = hidden ? null : current;
  return (
    <div className="pointer-events-none absolute top-14 left-1/2 flex -translate-x-1/2 justify-center">
      <AnimatePresence mode="wait" initial={false}>
        {shown && (
          <motion.div
            key={shown.id}
            className="pointer-events-auto relative"
            initial={reduced ? { opacity: 0 } : { y: "-100%" }}
            animate={reduced ? { opacity: 1 } : { y: 0 }}
            exit={reduced ? { opacity: 0 } : { y: "-100%" }}
            transition={SLIDE}
            onPointerEnter={() => holdToast(true)}
            onPointerLeave={() => holdToast(false)}
          >
            <Ear path={EAR_LEFT} className="right-[calc(100%-1px)]" />
            <Ear path={EAR_RIGHT} className="left-[calc(100%-1px)]" />
            <ToastBody toast={shown} className="h-10 max-w-[460px] px-2" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Mobile : capsule qui monte de derrière la pilule du bas. */
export function PillToast() {
  const current = useToast();
  const reduced = useReducedMotion();
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-[calc(78px+env(safe-area-inset-bottom))] z-30 flex justify-center lg:hidden">
      <AnimatePresence mode="wait" initial={false}>
        {current && (
          <motion.div
            key={current.id}
            className="pointer-events-auto max-w-full overflow-hidden rounded-full"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.94 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.94 }}
            transition={SLIDE}
          >
            <ToastBody toast={current} className="h-12 px-5" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Courbe du haut, noire : la lumière reste au centre, la languette sort du notch sans couture. */
function Ear({ path, className }: { path: string; className: string }) {
  return (
    <svg
      width="33"
      height="40"
      viewBox="0 0 33 40"
      aria-hidden="true"
      className={cn("absolute top-0", className)}
    >
      <path d={path} className="fill-ink" />
    </svg>
  );
}

/**
 * Halo : une lumière floue de la couleur du ton, centrée sous le bord bas ; le texte reste sur du
 * noir. Valeurs réglées par Moh (2026-11-07) : centre bien sous le bord, cœur plein à 70 %, plus
 * large que la languette (le fondu des côtés l'éteint avant les courbes).
 */
function Halo({ tone }: { tone: ToastTone }) {
  return (
    // Fondu sur les côtés : la lumière s'éteint avant les courbes noires, sans coupure.
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_right,transparent,black_22%,black_78%,transparent)]"
    >
      <span
        className="absolute -bottom-[180%] left-1/2 h-[210%] w-[120%] -translate-x-1/2 blur-[17px]"
        style={{ background: `radial-gradient(closest-side, ${GLOW[tone]} 70%, transparent)` }}
      />
    </span>
  );
}

function ToastBody({ toast, className }: { toast: Toast; className: string }) {
  const main = GLOW[toast.tone];
  const content = (
    <>
      <Halo tone={toast.tone} />
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-full"
        style={{ background: main, boxShadow: `0 0 10px ${main}` }}
      />
      <span className="min-w-0 truncate">{toast.message}</span>
      {toast.href && <ChevronRight className="size-4 shrink-0 text-on-ink-soft" />}
    </>
  );
  // `isolate` : le halo (-z-10) reste sous le texte mais au-dessus du fond noir.
  const classes = cn(
    "relative isolate flex items-center gap-3 overflow-hidden whitespace-nowrap bg-ink text-[15px] font-bold leading-5 text-on-ink",
    className,
  );
  if (toast.href) {
    return (
      <Link href={toast.href} onClick={() => dismissToast(toast.id)} className={classes}>
        {content}
      </Link>
    );
  }
  return <div className={classes}>{content}</div>;
}
