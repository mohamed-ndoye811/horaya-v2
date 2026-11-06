import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { getDashboard } from "@/functions/dashboard";

export const Route = createFileRoute("/app/")({
  loader: () => getDashboard(),
  head: () => ({ meta: [{ title: "Tableau de bord · Horaya" }] }),
  component: () => <DashboardPage data={Route.useLoaderData()} />,
});
