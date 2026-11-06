import { createFileRoute } from "@tanstack/react-router";
import { MorePage } from "@/features/settings/more-page";
import { getMoreMenu } from "@/functions/settings";

export const Route = createFileRoute("/app/plus")({
  loader: () => getMoreMenu(),
  head: () => ({ meta: [{ title: "Plus · Horaya" }] }),
  component: () => <MorePage data={Route.useLoaderData()} />,
});
