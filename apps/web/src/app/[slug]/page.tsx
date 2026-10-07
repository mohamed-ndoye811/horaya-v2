import { listPublicEvents } from "@horaya/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandBand, PublicNav } from "@/components/public/public-chrome";
import { PublicEvents } from "@/components/public/public-events";
import { cn } from "@/lib/cn";
import { displayFontClass } from "@/lib/fonts";
import { db } from "@/server/db";
import { getWorkspaceBySlug } from "@/server/public";

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const workspace = await getWorkspaceBySlug((await params).slug);
  return {
    title: workspace ? `${workspace.name} · Événements` : "Horaya",
    description: workspace?.description ?? undefined,
  };
}

/** Écran 27 : page publique d'un espace, ses événements à venir. */
export default async function PublicWorkspacePage({ params, searchParams }: PageProps<"/[slug]">) {
  const workspace = await getWorkspaceBySlug((await params).slug);
  if (!workspace) notFound();
  const query = await searchParams;
  const now = new Date();
  const events = await listPublicEvents(db, workspace.id, now);
  const tz = workspace.timezone;

  return (
    <>
      <BrandBand>
        <PublicNav workspace={workspace} active="events" />
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
              Nos événements
            </h1>
            {workspace.description && (
              <p className="max-w-[620px] text-base font-medium leading-6 opacity-90 sm:text-[19px] sm:leading-7">
                {workspace.description}
              </p>
            )}
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
        timeZone={tz}
        basePath={`/${workspace.slug}`}
        query={query}
        now={now}
      />
    </>
  );
}
