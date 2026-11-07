import { createFileRoute } from "@tanstack/react-router";
import { PlatformWorkspacePage } from "@/features/platform/workspace-page";
import { getPlatformWorkspace } from "@/functions/platform";

export const Route = createFileRoute("/app/plateforme/espaces/$id")({
  loader: ({ params }) => getPlatformWorkspace({ data: params.id }),
  head: () => ({ meta: [{ title: "Espace · Cockpit · Horaya" }] }),
  component: () => <PlatformWorkspacePage data={Route.useLoaderData()} />,
});
