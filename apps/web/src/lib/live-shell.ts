import { useEffect, useRef, useState } from "react";
import { pollAppShell } from "@/functions/app-shell";
import { type ToastTone, toast } from "@/lib/toast";

/** Couleur de la languette selon la notification. */
const TONES: Record<string, ToastTone> = {
  booking_created: "success",
  payment_received: "success",
  gift_card_purchased: "success",
  booking_cancelled: "warning",
};

/** Toutes les 20 s, onglet visible (et à chaque retour sur l'onglet). */
const POLL_MS = 20_000;

interface Counts {
  pendingBookings: number;
  unreadNotifications: number;
}

/**
 * Coque en direct : pastilles du notch à jour et nouvelles notifications en languette, sans
 * recharger la page. shortcut: une vérification toutes les 20 s plutôt qu'un flux (SSE) ; passer au
 * flux si l'attente devient gênante.
 */
export function useLiveShell(initial: Counts & { now: string }): Counts {
  const [counts, setCounts] = useState<Counts>(initial);
  const since = useRef(initial.now);
  /** Déjà montrées : une notification créée pendant un passage peut revenir au suivant. */
  const shown = useRef(new Set<string>());
  // Données de la coque rechargées (navigation, action) : elles font foi.
  useEffect(() => {
    setCounts({
      pendingBookings: initial.pendingBookings,
      unreadNotifications: initial.unreadNotifications,
    });
    since.current = initial.now;
  }, [initial.pendingBookings, initial.unreadNotifications, initial.now]);

  useEffect(() => {
    let busy = false;
    async function tick() {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const live = await pollAppShell(since.current);
        since.current = live.now;
        setCounts({
          pendingBookings: live.pendingBookings,
          unreadNotifications: live.unreadNotifications,
        });
        for (const entry of live.fresh) {
          if (shown.current.has(entry.id)) continue;
          shown.current.add(entry.id);
          toast(entry.message, {
            tone: TONES[entry.type] ?? "info",
            href: entry.link ?? undefined,
          });
        }
      } catch {
        // Réseau coupé ou session finie : on réessaie au prochain passage.
      } finally {
        busy = false;
      }
    }
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  return counts;
}
