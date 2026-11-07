import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PlatformHomePage } from "@/features/platform/platform-home";
import { getPlatformHome } from "@/functions/platform";

export const Route = createFileRoute("/app/plateforme/")({
  validateSearch: z.object({ q: z.string().max(100).optional().catch(undefined) }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getPlatformHome({ data: deps.q }),
  head: () => ({ meta: [{ title: "Cockpit · Horaya" }] }),
  component: () => <PlatformHomePage data={Route.useLoaderData()} />,
});
