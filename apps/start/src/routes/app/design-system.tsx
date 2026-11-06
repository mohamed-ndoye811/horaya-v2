import { createFileRoute } from "@tanstack/react-router";
import { DesignSystemPage } from "@/features/design-system/design-system-page";

export const Route = createFileRoute("/app/design-system")({
  head: () => ({ meta: [{ title: "Design system · Horaya" }] }),
  component: DesignSystemPage,
});
