import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RouteTransition } from "@/components/motion/route-transition";
import { ScrollZone } from "@/components/motion/scroll-zone";
import { brandStyle, contactHref, PublicFooter } from "@/components/public/public-chrome";
import { PublicNotch } from "@/components/public/public-notch";
import { getPublicWorkspace } from "@/functions/public";

/**
 * Pages publiques d'un espace : horaya.app/<adresse>. Sur grand écran, cadre sombre et notch
 * aux couleurs de l'espace (maquettes 5.1 à 5.6), comme l'admin.
 */
export const Route = createFileRoute("/$slug")({
  loader: ({ params }) => getPublicWorkspace({ data: params.slug }),
  component: PublicLayout,
});

function PublicLayout() {
  const workspace = Route.useLoaderData();
  return (
    <div
      style={brandStyle(workspace.brandColor)}
      className="flex min-h-dvh flex-col bg-bg lg:h-dvh lg:bg-ink lg:p-1.5 print:h-auto print:bg-white print:p-0"
    >
      <div className="print:hidden">
        <PublicNotch workspace={workspace} contact={contactHref(workspace)} />
      </div>
      <ScrollZone className="flex flex-1 flex-col scrollbar-none lg:min-h-0 lg:overflow-y-auto lg:rounded-[10px] lg:bg-bg print:overflow-visible">
        <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 pt-4 pb-6 lg:pt-[62px]">
          <RouteTransition>
            <Outlet />
          </RouteTransition>
        </div>
        <PublicFooter workspace={workspace} />
      </ScrollZone>
    </div>
  );
}
