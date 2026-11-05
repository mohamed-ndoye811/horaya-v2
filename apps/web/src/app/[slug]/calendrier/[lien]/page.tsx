import { listCalendarLinkEvents } from "@horaya/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicEvents, PublicHero } from "@/components/public/public-events";
import { NotFoundScreen } from "@/components/public/public-not-found";
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
    <div className="flex flex-col gap-6">
      <PublicHero
        eyebrow={workspace.name}
        title={link.name}
        lead={`${events.length} événement${events.length > 1 ? "s" : ""} à venir`}
        font={workspace.displayFont}
      />
      <PublicEvents
        events={events}
        workspaceSlug={workspace.slug}
        timeZone={workspace.timezone}
        basePath={`/${workspace.slug}/calendrier/${link.slug}`}
        query={await searchParams}
        now={now}
        linkSlug={link.slug}
      />
    </div>
  );
}
