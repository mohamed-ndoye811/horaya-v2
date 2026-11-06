import { createFileRoute } from "@tanstack/react-router";
import { InvitationPage } from "@/features/auth/invitation-page";
import { getInvitationPage } from "@/functions/invitations";

/** Page ouverte depuis l'e-mail d'invitation : rejoindre un espace existant. */
export const Route = createFileRoute("/invitation/$id")({
  loader: ({ params }) => getInvitationPage({ data: params.id }),
  head: () => ({ meta: [{ title: "Invitation · Horaya" }] }),
  component: () => <InvitationPage data={Route.useLoaderData()} />,
});
