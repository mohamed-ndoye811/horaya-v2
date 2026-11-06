import { createFileRoute } from "@tanstack/react-router";
import { NotificationsSettingsPage } from "@/features/settings/notifications-page";
import { getNotificationsSettings } from "@/functions/settings";

export const Route = createFileRoute("/app/parametres/notifications")({
  loader: () => getNotificationsSettings(),
  head: () => ({ meta: [{ title: "Notifications · Horaya" }] }),
  component: () => <NotificationsSettingsPage data={Route.useLoaderData()} />,
});
