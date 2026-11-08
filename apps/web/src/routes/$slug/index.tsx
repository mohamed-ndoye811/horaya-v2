import { TENANT_SECTORS } from "@horaya/core";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PublicEvents, PublicHero } from "@/components/public/public-events";
import { ButtonLink } from "@/components/ui/button";
import { getPublicHome } from "@/functions/public";
import { searchText } from "@/lib/search-params";

/** Maquette 5.1 : page publique d'un espace, ses événements à venir. */
export const Route = createFileRoute("/$slug/")({
  validateSearch: z.object({ type: searchText, tri: searchText }),
  loader: ({ params }) => getPublicHome({ data: params.slug }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.workspace.name} · Événements` : "Horaya" },
      ...(loaderData?.workspace.description
        ? [{ name: "description", content: loaderData.workspace.description }]
        : []),
    ],
  }),
  component: PublicWorkspacePage,
});

function PublicWorkspacePage() {
  const { workspace, events, now, hasPassPlans } = Route.useLoaderData();
  const sector = TENANT_SECTORS.find(
    (entry) => entry.value === workspace.sector && entry.value !== "other",
  );
  return (
    <div className="flex flex-col gap-6">
      <PublicHero
        eyebrow={sector?.label}
        title={workspace.name}
        lead={workspace.description}
        font={workspace.displayFont}
        cover={workspace.coverImageUrl}
      />
      {hasPassPlans && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-surface px-6 py-4">
          <p className="text-[15px] font-medium text-ink">
            Tu viens régulièrement ? Une carte de séances revient moins cher à la séance.
          </p>
          <ButtonLink href={`/${workspace.slug}/cartes`} variant="brand" arrow>
            Acheter une carte
          </ButtonLink>
        </div>
      )}
      <PublicEvents
        events={events}
        workspaceSlug={workspace.slug}
        timeZone={workspace.timezone}
        basePath={`/${workspace.slug}`}
        query={Route.useSearch()}
        now={now}
      />
    </div>
  );
}
