"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { SOFT } from "./indicator";

/**
 * Liste dont on ajoute, retire ou réordonne les éléments : le nouveau se fond, celui qui part
 * s'efface sur place, les autres glissent à leur place (transform seul). Le parent doit être
 * `relative` (l'élément qui part sort du flux le temps de s'effacer) ; chaque `PresenceItem` a
 * une `key` stable. La première apparition de la liste ne s'anime pas.
 */
export function PresenceList({ children }: { children: ReactNode }) {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {children}
    </AnimatePresence>
  );
}

export function PresenceItem({
  as = "div",
  className,
  children,
}: {
  as?: "div" | "li" | "article";
  className?: string;
  children: ReactNode;
}) {
  const Tag = motion[as];
  return (
    <Tag
      layout="position"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={SOFT}
      className={className}
    >
      {children}
    </Tag>
  );
}
