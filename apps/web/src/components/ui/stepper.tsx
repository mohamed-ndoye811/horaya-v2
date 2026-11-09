"use client";

import { AnimatePresence, motion, type Variants } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Chiffre qui roule d'une hauteur entière (jamais deux chiffres superposés) : `custom` vaut 1
 * quand on ajoute, -1 quand on retire.
 */
const ROLL: Variants = {
  enter: (rise: number) => ({ y: `${100 * rise}%`, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (rise: number) => ({ y: `${-100 * rise}%`, opacity: 0 }),
};

const round =
  "flex size-10 items-center justify-center rounded-full text-lg leading-[18px] transition-[color,background-color,scale] active:scale-90";

/**
 * Compteur − n + (places, exemplaires) : pilule blanche, « + » en noir (maquette 1.6b).
 * Boutons de 40 px, désactivés aux bornes ; `label` nomme la valeur pour les lecteurs d'écran.
 */
export function Stepper({
  value,
  onChange,
  min,
  max,
  label,
  size = "md",
}: {
  /** `pill` : 32 px, dans une ligne de réglage (maquette 9.5, « Places par créneau »). */
  size?: "md" | "pill";
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  /** « Places », « Exemplaires » : lu avec la valeur et sur les deux boutons. */
  label: string;
}) {
  // Le chiffre roule : il arrive par le bas quand on ajoute, par le haut quand on retire.
  const previous = useRef(value);
  const rise = value >= previous.current ? 1 : -1;
  useEffect(() => {
    previous.current = value;
  }, [value]);
  if (size === "pill") {
    return (
      <div className="flex h-8 shrink-0 items-center rounded-lg border border-bg bg-field">
        <button
          type="button"
          aria-label={`Moins (${label})`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className="h-full w-[30px] text-base leading-4 text-ink disabled:text-ink-faint"
        >
          −
        </button>
        <output
          aria-label={label}
          aria-live="polite"
          className="w-6 text-center text-meta font-semibold leading-4 text-ink tabular-nums"
        >
          {value}
        </output>
        <button
          type="button"
          aria-label={`Plus (${label})`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="h-full w-[30px] text-base leading-4 text-ink disabled:text-ink-faint"
        >
          +
        </button>
      </div>
    );
  }
  return (
    <div className="flex shrink-0 items-center gap-2.5 rounded-full border border-bg bg-surface p-1">
      <button
        type="button"
        aria-label={`Moins (${label})`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className={cn(round, "border border-line text-ink disabled:text-ink-subtle")}
      >
        −
      </button>
      <output
        aria-label={label}
        aria-live="polite"
        className={cn(
          "relative flex min-w-4 justify-center overflow-hidden text-[17px] font-semibold leading-5 tabular-nums",
          value === 0 ? "text-ink-subtle" : "text-ink",
        )}
      >
        {/* L'ancien chiffre sort pendant que le nouveau arrive (popLayout : il ne prend plus de place). */}
        <AnimatePresence initial={false} mode="popLayout" custom={rise}>
          <motion.span
            key={value}
            custom={rise}
            variants={ROLL}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", visualDuration: 0.2, bounce: 0 }}
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </output>
      <button
        type="button"
        aria-label={`Plus (${label})`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className={cn(round, "bg-ink text-on-ink disabled:bg-line-soft disabled:text-ink-subtle")}
      >
        +
      </button>
    </div>
  );
}
