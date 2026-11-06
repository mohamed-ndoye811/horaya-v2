import { createFileRoute } from "@tanstack/react-router";
import { JoinPage } from "@/features/auth/join-page";
import { getJoinPage } from "@/functions/invitations";

/** Lien d'invitation général d'un espace (écran 25, « Copier le lien d'invitation »). */
export const Route = createFileRoute("/rejoindre/$token")({
  loader: ({ params }) => getJoinPage({ data: params.token }),
  head: () => ({
    meta: [{ title: "Rejoindre un espace · Horaya" }, { name: "robots", content: "noindex" }],
  }),
  component: () => <JoinPage data={Route.useLoaderData()} />,
});
