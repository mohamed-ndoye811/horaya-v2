import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PublicEvents, PublicHero } from "@/components/public/public-events";
import { NotFoundScreen } from "@/components/public/public-not-found";
import { getCalendarLinkPage } from "@/functions/public";
import { searchText } from "@/lib/search-params";

/** Lien calendrier : les événements choisis par l'équipe, « sur invitation » compris. */
export const Route = createFileRoute("/$slug/calendrier/$lien")({
  validateSearch: z.object({ type: searchText, tri: searchText, filtre: searchText }),
  loader: ({ params }) => getCalendarLinkPage({ data: params }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.link
          ? `${loaderData.link.name} · ${loaderData.workspace.name}`
          : (loaderData?.workspace.name ?? "Horaya"),
      },
      // Un lien calendrier se partage, il ne se référence pas.
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CalendarLinkPage,
});

function CalendarLinkPage() {
  const { workspace, link, events, now } = Route.useLoaderData();
  const query = Route.useSearch();
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
  return (
    <div className="flex flex-col gap-6">
      <PublicHero
        eyebrow={workspace.name}
        title={link.name}
        lead={`${events.length} événement${events.length > 1 ? "s" : ""} à venir`}
        font={workspace.displayFont}
        cover={workspace.coverImageUrl}
      />
      <PublicEvents
        events={events}
        workspaceSlug={workspace.slug}
        timeZone={workspace.timezone}
        basePath={`/${workspace.slug}/calendrier/${link.slug}`}
        query={query}
        now={now}
        linkSlug={link.slug}
      />
    </div>
  );
}
