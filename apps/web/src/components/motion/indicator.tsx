"use client";

import { MotionConfig, motion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Ressort commun aux mouvements pilotés par `motion` : même tempo que `--dur-3` (app.css), sans
 * rebond. Interrompu (clic rapide d'un onglet à l'autre), il repart avec son élan au lieu de
 * redémarrer sa courbe.
 */
export const SOFT = { type: "spring", visualDuration: 0.38, bounce: 0 } as const;

/**
 * Repère de l'élément actif qui glisse d'un onglet à l'autre (onglets, segments, menu,
 * étapes). À poser dans l'élément actif, `relative isolate` : un fond (`-z-10`) passe sous
 * le contenu, un trait se place où on veut.
 */
export function ActiveIndicator({ id, className }: { id: string; className: string }) {
  return (
    <motion.span
      aria-hidden="true"
      layoutId={id}
      transition={SOFT}
      className={`absolute ${className}`}
    />
  );
}

/** Préférences globales : la même courbe partout, et rien ne bouge si l'utilisateur l'a demandé. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={SOFT}>
      {children}
    </MotionConfig>
  );
}
