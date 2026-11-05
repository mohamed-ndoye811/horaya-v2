import { notFound } from "next/navigation";
import { RouteTransition } from "@/components/motion/route-transition";
import { brandStyle, contactHref, PublicFooter } from "@/components/public/public-chrome";
import { PublicNotch } from "@/components/public/public-notch";
import { getWorkspaceBySlug } from "@/server/public";

/**
 * Pages publiques d'un espace : horaya.app/<adresse>. Sur grand écran, cadre sombre et notch
 * aux couleurs de l'espace (maquettes 5.1 à 5.6), comme l'admin.
 */
export default async function PublicLayout({ children, params }: LayoutProps<"/[slug]">) {
  const workspace = await getWorkspaceBySlug((await params).slug);
  if (!workspace) notFound();
  return (
    <div
      style={brandStyle(workspace.brandColor)}
      className="flex min-h-dvh flex-col bg-bg lg:h-dvh lg:bg-ink lg:p-1.5"
    >
      <PublicNotch workspace={workspace} contact={contactHref(workspace)} />
      <div className="flex flex-1 flex-col lg:min-h-0 lg:overflow-y-auto lg:rounded-[10px] lg:bg-bg">
        <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 pt-4 pb-6 lg:pt-[62px]">
          <RouteTransition>{children}</RouteTransition>
        </div>
        <PublicFooter workspace={workspace} />
      </div>
    </div>
  );
}
