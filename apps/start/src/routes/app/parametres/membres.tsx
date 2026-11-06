import { createFileRoute } from "@tanstack/react-router";
import { MembersSettingsPage } from "@/features/settings/members-page";
import { getMembersSettings } from "@/functions/settings";

export const Route = createFileRoute("/app/parametres/membres")({
  loader: () => getMembersSettings(),
  head: () => ({ meta: [{ title: "Membres & rôles · Horaya" }] }),
  component: () => <MembersSettingsPage data={Route.useLoaderData()} />,
});
