"use client";

import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useState } from "react";
import { SOFT } from "./indicator";

/**
 * Section qui s'ouvre et se ferme en hauteur (lignes dépliables, « Voir les séances », question
 * conditionnelle). Fermée, elle n'est plus dans la page (rien à atteindre au clavier). Ouverte
 * d'emblée, elle s'affiche sans animation. Le contenu est rogné seulement pendant le
 * mouvement : un contour de focus n'est jamais coupé au repos.
 */
export function Collapse({
  open,
  children,
  className,
  keepMounted = false,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
  /** Fermée, la section reste dans la page (ses champs sont toujours envoyés), inerte. */
  keepMounted?: boolean;
}) {
  if (keepMounted)
    return (
      <motion.div
        inert={!open}
        className={className}
        initial={false}
        animate={
          open
            ? { height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }
            : { height: 0, opacity: 0, overflow: "hidden" }
        }
        transition={SOFT}
      >
        {children}
      </motion.div>
    );
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="collapse"
          className={className}
          initial={{ height: 0, opacity: 0, overflow: "hidden" }}
          animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
          exit={{ height: 0, opacity: 0, overflow: "hidden" }}
          transition={SOFT}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Ligne dépliable : un bouton (`summary`) et sa section, qui s'ouvre en hauteur. Remplace
 * `<details>`, qu'on ne peut pas animer. `summary` reçoit l'état pour changer son libellé.
 */
export function Disclosure({
  summary,
  children,
  className,
  summaryClassName,
  defaultOpen = false,
}: {
  summary: ReactNode | ((open: boolean) => ReactNode);
  children: ReactNode;
  className?: string;
  summaryClassName?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={summaryClassName}
      >
        {typeof summary === "function" ? summary(open) : summary}
      </button>
      <Collapse open={open}>{children}</Collapse>
    </div>
  );
}
