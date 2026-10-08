import type { Metadata } from "next";
import { NotFoundScreen } from "@/components/public/public-not-found";
import { getSession } from "@/server/auth";

export const metadata: Metadata = { title: "Page introuvable · Horaya" };

/** Écran 28b. Le tableau de bord n'est proposé qu'à une personne connectée. */
export default async function NotFound() {
  const session = await getSession();
  return (
    <div className="flex min-h-dvh flex-col">
      {session ? (
        <NotFoundScreen
          primary={{ label: "Retour au tableau de bord", href: "/app" }}
          secondary={{ label: "Voir les événements à venir", href: "/app/evenements" }}
        />
      ) : (
        <NotFoundScreen
          primary={{ label: "Retour à l'accueil", href: "/" }}
          secondary={{ label: "Se connecter", href: "/connexion" }}
        />
      )}
    </div>
  );
}
