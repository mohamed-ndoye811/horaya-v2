import { createFileRoute } from "@tanstack/react-router";
import { EnrollPage } from "@/features/enrollments/enroll-page";
import { getEnrollEventPage } from "@/functions/public";

/** Cours à l'année : inscription à toutes les séances restantes de la série. */
export const Route = createFileRoute("/$slug/$event/inscription")({
  loader: ({ params }) => getEnrollEventPage({ data: { slug: params.slug, event: params.event } }),
  head: () => ({
    meta: [{ title: "Inscris-toi au trimestre" }, { name: "robots", content: "noindex" }],
  }),
  component: Enroll,
});

function Enroll() {
  return <EnrollPage eventSlug={Route.useParams().event} data={Route.useLoaderData()} />;
}
