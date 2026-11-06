"use client";

import { motion, useMotionValue, useScroll, useTransform } from "motion/react";
import { type ReactNode, useEffect, useRef } from "react";

/** Hauteur minimale du curseur de défilement, pour qu'il reste visible sur une longue page. */
const THUMB_MIN = 32;

/**
 * Zone qui défile dans le cadre (grand écran). La barre native est masquée, une barre fine posée
 * par-dessus le contenu indique où l'on est. Elle ne prend aucune place : rien ne bouge quand la
 * hauteur du contenu change. `layoutScroll` : les animations de mise en page (tableaux) tiennent
 * compte du défilement.
 */
export function ScrollZone({ className, children }: { className: string; children: ReactNode }) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ container: zoneRef });
  const rail = useMotionValue(0);
  const size = useMotionValue(0);
  const y = useTransform(() => scrollYProgress.get() * (rail.get() - size.get()));

  useEffect(() => {
    const zone = zoneRef.current;
    const track = railRef.current;
    if (!zone || !track) return;
    const measure = () => {
      const ratio = zone.clientHeight / zone.scrollHeight;
      rail.set(track.clientHeight);
      size.set(ratio < 1 ? Math.max(THUMB_MIN, track.clientHeight * ratio) : 0);
    };
    measure();
    // La zone change de taille avec la fenêtre, son contenu avec la page affichée.
    const observer = new ResizeObserver(measure);
    observer.observe(zone);
    for (const child of zone.children) observer.observe(child);
    return () => observer.disconnect();
  }, [rail, size]);

  return (
    <>
      <motion.div ref={zoneRef} layoutScroll data-scroll-zone className={className}>
        {children}
      </motion.div>
      <div
        ref={railRef}
        aria-hidden="true"
        className="pointer-events-none fixed top-3 right-2.5 bottom-3 z-30 hidden w-1 lg:block"
      >
        <motion.div className="w-full rounded-full bg-ink/25" style={{ height: size, y }} />
      </div>
    </>
  );
}
