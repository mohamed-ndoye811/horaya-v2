"use client";

import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { inkCardClasses } from "@/components/ui/section";
import { cn } from "@/lib/cn";

/** Étapes de la visite (maquette 4.8) : chaque étape vise un repère `data-tour` de la coque. */
const STEPS = [
  {
    target: "notch",
    title: "Le notch : ta navigation",
    text: "Tableau de bord, calendrier, événements, réservations, matériel, clients et paramètres : tout est en haut, au centre. La pastille orange signale des réservations à valider.",
  },
  {
    target: "actions",
    title: "À droite : les actions de la page",
    text: "Elles changent avec l'écran. Ici : créer un événement ou ouvrir ta page publique. Sur une fiche, tu y trouveras Modifier ou Exporter. Le bouton noir, c'est l'action principale.",
  },
  {
    target: "breadcrumb",
    title: "À gauche : où tu es",
    text: "Le nom de la page et son contexte, toujours au même endroit : tu sais d'un coup d'œil où tu te trouves.",
  },
  {
    target: null,
    title: "Enregistrer : toujours en bas",
    text: "Dans un formulaire, la barre noire en bas de l'écran réunit l'enregistrement et ce qu'il reste à faire. Elle te suit quand tu fais défiler.",
  },
] as const;

const POPOVER_WIDTH = 380;
const STORAGE_KEY = "horaya:visite";

/** Mémorise la visite (« faite » ou « plus tard ») ; le stockage peut être indisponible. */
export function rememberTour(value: "faite" | "plus-tard") {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {}
}

export function tourDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Visite guidée sur grand écran : le repère visé reste net, le reste de l'écran s'assombrit,
 * une bulle explique l'étape. Échap ou « Passer la visite » la ferme.
 */
export function GuidedTour({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const step = STEPS[index] ?? STEPS[0];
  const reduced = useReducedMotion();
  const last = index === STEPS.length - 1;

  const close = useCallback(() => {
    rememberTour("faite");
    onClose();
  }, [onClose]);

  useEffect(() => {
    const measure = () => {
      const element = step.target ? document.querySelector(`[data-tour="${step.target}"]`) : null;
      setRect(element ? element.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [step.target]);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const pad = 6;
  const popoverStyle = rect
    ? {
        top: rect.bottom + pad + 16,
        left: Math.min(
          Math.max(16, rect.left + rect.width / 2 - POPOVER_WIDTH / 2),
          window.innerWidth - POPOVER_WIDTH - 16,
        ),
      }
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return (
    <div className="fixed inset-0 z-[60] hidden lg:block">
      {/* Bloque les clics sur la page pendant la visite. */}
      <div aria-hidden="true" className="absolute inset-0" onClick={close} />
      {rect ? (
        // Le repère glisse d'une cible à l'autre : position en transformations, seule la taille passe par la mise en page.
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 rounded-full ring-2 ring-accent"
          initial={false}
          animate={{
            x: rect.left - pad,
            y: rect.top - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
          }}
          transition={reduced ? { duration: 0 } : undefined}
          style={{
            boxShadow: "0 0 0 4px rgba(240,151,95,0.25), 0 0 0 9999px rgba(17,17,17,0.45)",
          }}
        />
      ) : (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-ink/45" />
      )}

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="visite-titre"
        tabIndex={-1}
        className="absolute flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] outline-none"
        style={{ width: POPOVER_WIDTH, ...popoverStyle }}
      >
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-accent-strong">
            Étape {index + 1} sur {STEPS.length}
          </p>
          <button
            type="button"
            onClick={close}
            className="text-[13px] font-medium text-ink-subtle hover:text-ink"
          >
            Passer la visite
          </button>
        </div>
        <h2 id="visite-titre" className="text-lg font-semibold leading-[22px] text-ink">
          {step.title}
        </h2>
        <p className="text-sm leading-[22px] text-ink-muted">{step.text}</p>
        <div className="flex items-center justify-between pt-1">
          <span aria-hidden="true" className="flex gap-1.5">
            {STEPS.map((entry, dot) => (
              <span
                key={entry.title}
                className={cn(
                  "h-1.5 rounded-full",
                  dot === index ? "w-[18px] bg-ink" : "w-1.5 bg-line",
                )}
              />
            ))}
          </span>
          <span className="flex gap-2">
            {index > 0 && (
              <Button variant="secondary" size="sm" onClick={() => setIndex(index - 1)}>
                Précédent
              </Button>
            )}
            <Button size="sm" onClick={() => (last ? close() : setIndex(index + 1))}>
              {last ? "Terminer" : "Suivant"}
            </Button>
          </span>
        </div>
      </div>

      <ol
        className={cn(
          inkCardClasses,
          "absolute bottom-4 left-4 flex flex-col gap-2 rounded-[20px] px-5 py-4 text-[13px] leading-[18px]",
        )}
      >
        <li className="pb-0.5 text-xs font-semibold text-on-ink-muted">La visite</li>
        {STEPS.map((entry, position) => (
          <li
            key={entry.title}
            className={cn(position === index ? "font-semibold text-on-ink" : "text-on-ink-muted")}
          >
            {position < index ? "✓ " : position === index ? "→ " : ""}
            {position + 1}. {entry.title}
          </li>
        ))}
      </ol>
    </div>
  );
}
