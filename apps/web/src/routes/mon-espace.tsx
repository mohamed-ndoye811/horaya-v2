import { createFileRoute, Outlet } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { HorayaWordmark } from "@/components/app/logo";
import { RouteTransition } from "@/components/motion/route-transition";
import { ScrollZone } from "@/components/motion/scroll-zone";
import { NotchShell, notchLinkClasses } from "@/components/public/public-notch";
import { SignOutButton } from "@/features/customer-space/actions";
import { getCustomerSignedIn } from "@/functions/customer-space";
import { Link } from "@/lib/navigation";

/**
 * Vue neutre horaya.app de l'espace client (maquette 8.5) : couleurs d'Horaya, les boutons
 * « marque » en noir, chaque atelier repéré par une pastille à sa couleur.
 */
const neutral = {
  "--brand": "var(--color-ink)",
  "--on-brand": "var(--color-on-ink)",
  "--brand-text": "var(--color-ink-muted)",
  "--brand-light": "var(--color-accent)",
} as CSSProperties;

export const Route = createFileRoute("/mon-espace")({
  loader: () => getCustomerSignedIn(),
  component: NeutralLayout,
});

function NeutralLayout() {
  const signedIn = Route.useLoaderData();
  return (
    <div style={neutral} className="flex min-h-dvh flex-col bg-bg lg:h-dvh lg:bg-ink lg:p-1.5">
      <NotchShell
        label="Mes réservations"
        brand={
          <Link href="/" className="pr-1.5 text-on-ink" aria-label="Horaya">
            <HorayaWordmark height={12} />
          </Link>
        }
      >
        <Link href="/mon-espace" aria-current="page" className={notchLinkClasses(true)}>
          Mes réservations
        </Link>
        {signedIn && <SignOutButton slug={null} className={notchLinkClasses(false)} />}
      </NotchShell>
      <header className="flex items-center justify-between gap-3 px-4 pt-3 lg:hidden">
        <Link href="/" className="text-ink" aria-label="Horaya">
          <HorayaWordmark height={14} />
        </Link>
        {signedIn && (
          <SignOutButton
            slug={null}
            className="tap-area text-meta font-semibold leading-4 text-ink-muted hover:text-ink"
          />
        )}
      </header>
      <ScrollZone className="flex flex-1 flex-col scrollbar-none lg:min-h-0 lg:overflow-y-auto lg:rounded-[10px] lg:bg-bg">
        <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 pt-4 pb-6 lg:pt-[62px]">
          <RouteTransition>
            <Outlet />
          </RouteTransition>
        </div>
        <footer className="flex flex-col gap-2 px-5 pt-2 pb-5 text-meta leading-4 text-ink-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>Horaya</p>
          <p className="font-semibold">Chaque atelier ne voit que ses propres réservations</p>
        </footer>
      </ScrollZone>
    </div>
  );
}
