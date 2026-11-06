import { createFileRoute } from "@tanstack/react-router";
import { ProfileSettingsPage } from "@/features/settings/profile-page";
import { getProfileSettings } from "@/functions/settings";

export const Route = createFileRoute("/app/parametres/profil")({
  loader: () => getProfileSettings(),
  head: () => ({ meta: [{ title: "Profil · Horaya" }] }),
  component: () => <ProfileSettingsPage data={Route.useLoaderData()} />,
});
