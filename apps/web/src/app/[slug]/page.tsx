import { TENANT_SECTORS } from "@horaya/core";
import { listPublicEvents } from "@horaya/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicEvents, PublicHero } from "@/components/public/public-events";
import { db } from "@/server/db";
import { getWorkspaceBySlug } from "@/server/public";

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const workspace = await getWorkspaceBySlug((await params).slug);
  return {
    title: workspace ? `${workspace.name} · Événements` : "Horaya",
    description: workspace?.description ?? undefined,
  };
}

/** Maquette 5.1 : page publique d'un espace, ses événements à venir. */
export default async function PublicWorkspacePage({ params, searchParams }: PageProps<"/[slug]">) {
  const workspace = await getWorkspaceBySlug((await params).slug);
  if (!workspace) notFound();
  const query = await searchParams;
  const now = new Date();
  const events = await listPublicEvents(db, workspace.id, now);
  const tz = workspace.timezone;

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
      />
      <PublicEvents
        events={events}
        workspaceSlug={workspace.slug}
        timeZone={tz}
        basePath={`/${workspace.slug}`}
        query={query}
        now={now}
      />
    </div>
  );
}
