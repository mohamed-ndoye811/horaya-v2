import { notFound } from "next/navigation";
import { brandStyle, PublicFooter } from "@/components/public/public-chrome";
import { getWorkspaceBySlug } from "@/server/public";

/** Pages publiques d'un espace : horaya.app/<adresse>. */
export default async function PublicLayout({ children, params }: LayoutProps<"/[slug]">) {
  const workspace = await getWorkspaceBySlug((await params).slug);
  if (!workspace) notFound();
  return (
    <div style={brandStyle(workspace.brandColor)} className="flex min-h-dvh flex-col bg-bg">
      <div className="flex flex-1 flex-col">{children}</div>
      <PublicFooter workspace={workspace} />
    </div>
  );
}
