import { listCalendarLinkEvents } from "@horaya/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandBand, PublicNav } from "@/components/public/public-chrome";
import { PublicEvents } from "@/components/public/public-events";
import { NotFoundScreen } from "@/components/public/public-not-found";
import { cn } from "@/lib/cn";
import { displayFontClass } from "@/lib/fonts";
import { db } from "@/server/db";
import { getCalendarLink, getWorkspaceBySlug } from "@/server/public";

async function load(params: PageProps<"/[slug]/calendrier/[lien]">["params"]) {
  const { slug, lien } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  return { workspace, link: await getCalendarLink(workspace.id, lien) };
}

export async function generateMetadata({
  params,
}: PageProps<"/[slug]/calendrier/[lien]">): Promise<Metadata> {
  const { workspace, link } = await load(params);
  // Un lien calendrier se partage, il ne se référence pas.
  return {
    title: link ? `${link.name} · ${workspace.name}` : workspace.name,
    robots: { index: false },
  };
}

/** Lien calendrier : les événements choisis par l'équipe, « sur invitation » compris. */
export default async function CalendarLinkPage({
  params,
  searchParams,
}: PageProps<"/[slug]/calendrier/[lien]">) {
  const { workspace, link } = await load(params);
  if (!link) {
    return (
      <NotFoundScreen
        wordmark={false}
        title="Ce calendrier n'est plus partagé."
        text="Le lien a été désactivé ou remplacé. Demande-en un nouveau à l'organisateur."
        primary={{ label: "Voir les événements publics", href: `/${workspace.slug}` }}
      />
    );
  }
  const now = new Date();
  const events = await listCalendarLinkEvents(db, link, now);

  return (
    <>
      <BrandBand>
        <PublicNav workspace={workspace} />
        <div className="flex flex-col gap-6 px-5 pt-8 pb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-16 sm:px-16 sm:py-14">
          <div className="flex min-w-0 flex-col gap-5">
            <p className="font-mono text-label font-semibold uppercase tracking-[0.055em] opacity-85">
              {workspace.name}
            </p>
            <h1
              className={cn(
                "text-[56px] leading-[52px] sm:text-[112px] sm:leading-[100px]",
                displayFontClass(workspace.displayFont),
              )}
            >
              {link.name}
            </h1>
          </div>
          <div className="flex shrink-0 items-baseline gap-3 sm:flex-col sm:items-end sm:gap-1">
            <span className="font-headline text-[32px] leading-8 sm:text-display sm:leading-[60px]">
              {events.length}
            </span>
            <span className="font-mono text-label font-semibold uppercase tracking-[0.055em] opacity-85">
              Événement{events.length > 1 ? "s" : ""} à venir
            </span>
          </div>
        </div>
      </BrandBand>
      <PublicEvents
        events={events}
        workspaceSlug={workspace.slug}
        timeZone={workspace.timezone}
        basePath={`/${workspace.slug}/calendrier/${link.slug}`}
        query={await searchParams}
        now={now}
        linkSlug={link.slug}
      />
    </>
  );
}
