import type { Metadata } from "next";
import { NotFoundScreen } from "@/components/public/public-not-found";

export const metadata: Metadata = { title: "Page introuvable · Horaya" };

/** Écran 28b. */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <NotFoundScreen
        primary={{ label: "Retour au tableau de bord", href: "/app" }}
        secondary={{ label: "Voir les événements à venir", href: "/app/evenements" }}
      />
    </div>
  );
}
