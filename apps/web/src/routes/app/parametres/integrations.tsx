import { createFileRoute } from "@tanstack/react-router";
import { IntegrationsSettingsPage } from "@/features/settings/integrations-page";

export const Route = createFileRoute("/app/parametres/integrations")({
  head: () => ({ meta: [{ title: "Intégrations · Horaya" }] }),
  component: IntegrationsSettingsPage,
});
