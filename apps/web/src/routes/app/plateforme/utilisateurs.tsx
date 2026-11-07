import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PlatformUsersPage } from "@/features/platform/users-page";
import { getPlatformUsers } from "@/functions/platform";

export const Route = createFileRoute("/app/plateforme/utilisateurs")({
  validateSearch: z.object({ q: z.string().max(100).optional().catch(undefined) }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getPlatformUsers({ data: deps.q }),
  head: () => ({ meta: [{ title: "Comptes · Cockpit · Horaya" }] }),
  component: () => <PlatformUsersPage data={Route.useLoaderData()} />,
});
