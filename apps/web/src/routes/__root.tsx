/// <reference types="vite/client" />
import "@fontsource-variable/urbanist";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { MotionProvider } from "@/components/motion/indicator";
import { NotFoundScreen } from "@/components/public/public-not-found";
import { authClient } from "@/lib/auth-client";
import appCss from "@/styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      // viewport-fit=cover : le fond va jusqu'aux bords de l'iPhone ; les zones sûres
      // (env(safe-area-inset-*)) sont gérées par app.css, la capsule du bas et les barres d'action.
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Horaya" },
      {
        name: "description",
        content: "Réservations, événements et matériel dans un seul agenda, sous ta marque.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "preload",
        href: "/fonts/PaperMono-Variable.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootDocument,
  component: Outlet,
  notFoundComponent: NotFound,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className="h-full antialiased">
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-full flex-col">
        <MotionProvider>{children}</MotionProvider>
        <Scripts />
      </body>
    </html>
  );
}

/** Écran 28b. Le tableau de bord n'est proposé qu'à une personne connectée. */
function NotFound() {
  // shortcut: session lue dans le navigateur (pas de loader ici), la version « connecté »
  // s'affiche après un court instant ; passer par le loader racine si ça gêne.
  const { data: session } = authClient.useSession();
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
