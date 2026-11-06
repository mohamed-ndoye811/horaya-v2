/// <reference types="vite/client" />
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/urbanist";
import "@fontsource-variable/geist-mono";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { MotionProvider } from "@/components/motion/indicator";
import appCss from "@/styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Horaya" },
      {
        name: "description",
        content: "Réservations, événements et matériel dans un seul agenda, sous ta marque.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico" },
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

/** Page introuvable (et, le temps de la migration, écrans pas encore portés). */
function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="font-headline text-[56px] leading-[58px] tracking-headline text-ink">
        Page introuvable
      </p>
      <p className="text-base text-ink-muted">
        Cette page n'existe pas, ou n'est pas encore portée sur la nouvelle app.
      </p>
      <a href="/app" className="text-sm font-semibold text-ink underline">
        Retour au tableau de bord
      </a>
    </main>
  );
}
