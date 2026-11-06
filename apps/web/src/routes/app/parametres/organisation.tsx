import { createFileRoute } from "@tanstack/react-router";
import { OrganizationSettingsPage } from "@/features/settings/organization-page";
import { getOrganizationSettings } from "@/functions/settings";

export const Route = createFileRoute("/app/parametres/organisation")({
  loader: () => getOrganizationSettings(),
  head: () => ({ meta: [{ title: "Organisation & marque · Horaya" }] }),
  component: () => <OrganizationSettingsPage data={Route.useLoaderData()} />,
});
