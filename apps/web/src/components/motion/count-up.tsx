"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { splitCount } from "@/lib/count-up";

const format = new Intl.NumberFormat("fr-FR");

/**
 * Chiffre clé qui défile jusqu'à sa valeur (« 1 240 € » part de 0). Le serveur rend la
 * valeur finale (lisible sans JavaScript) ; le défilement démarre à l'hydratation, pendant
 * que la tuile apparaît. Une valeur sans nombre est affichée telle quelle. Quand la valeur
 * change ensuite (un total qui suit un choix), le défilement part de la précédente.
 */
export function CountUp({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const previous = useRef(0);

  useEffect(() => {
    const parts = splitCount(value);
    const node = ref.current;
    if (!parts || !node || reduced) return;
    const from = previous.current;
    previous.current = parts.target;
    const controls = animate(from, parts.target, {
      duration: 0.9,
      ease: [0.2, 0, 0, 1],
      onUpdate: (current) => {
        node.textContent = `${parts.before}${format.format(Math.round(current))}${parts.after}`;
      },
      onComplete: () => {
        node.textContent = value;
      },
    });
    return () => controls.stop();
  }, [value, reduced]);

  // La valeur finale, invisible, réserve la largeur : Urbanist n'a pas de chiffres à chasse fixe,
  // le texte autour ne bouge donc pas pendant le défilement.
  return (
    <span className="relative inline-block">
      <span className="invisible">{value}</span>
      <span ref={ref} className="absolute inset-0 whitespace-nowrap">
        {value}
      </span>
    </span>
  );
}
