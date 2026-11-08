import { TENANT_SECTORS } from "@horaya/core";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PublicEvents, PublicHero } from "@/components/public/public-events";
import { ButtonLink } from "@/components/ui/button";
import { getPublicHome } from "@/functions/public";
import { formatMoney } from "@/lib/format";
import { Link } from "@/lib/navigation";
import { searchText } from "@/lib/search-params";

/** Maquette 5.1 : page publique d'un espace, ses événements à venir. */
export const Route = createFileRoute("/$slug/")({
  validateSearch: z.object({ type: searchText, tri: searchText, filtre: searchText }),
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
  const { workspace, events, now, hasPassPlans, slotTypes } = Route.useLoaderData();
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
      {workspace.giftCardsEnabled && (
        <Link
          href={`/${workspace.slug}/bon-cadeau`}
          className="flex items-center justify-between gap-4 rounded-3xl bg-surface px-6 py-5 transition-colors hover:bg-field"
        >
          <span className="flex flex-col gap-0.5">
            <span className="text-lg font-semibold leading-[22px] text-ink">
              Offrir un bon cadeau
            </span>
            <span className="text-sm leading-5 text-ink-muted">
              Un atelier à partager avec quelqu'un que tu aimes.
            </span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-[var(--brand-text)]">Offrir →</span>
        </Link>
      )}
      {slotTypes.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="px-1 text-xl font-medium leading-[26px] text-ink">Sur rendez-vous</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {slotTypes.map((type) => (
              <Link
                key={type.id}
                href={`/${workspace.slug}/creneaux/${type.id}`}
                className="flex flex-col gap-2 rounded-3xl bg-surface p-5 transition-colors hover:bg-field"
              >
                <span className="flex items-center gap-2 text-[13px] font-semibold leading-4 text-ink-muted">
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-[3px]"
                    style={{ backgroundColor: type.color }}
                  />
                  {type.durations.length ? type.durations.join(" · ") : "Tu choisis ton créneau"}
                </span>
                <span className="text-lg font-semibold leading-[22px] text-ink">{type.name}</span>
                {type.description && (
                  <span className="line-clamp-2 text-sm leading-5 text-ink-muted">
                    {type.description}
                  </span>
                )}
                <span className="flex items-baseline justify-between gap-3 pt-1">
                  <span className="text-[15px] font-semibold text-ink">
                    {type.fromCents > 0
                      ? `${type.durations.length > 1 ? "Dès " : ""}${formatMoney(type.fromCents)}`
                      : "Gratuit"}
                  </span>
                  <span className="text-sm font-semibold text-[var(--brand-text)]">
                    Choisir un créneau →
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
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
