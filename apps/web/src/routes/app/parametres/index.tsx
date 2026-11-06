import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/parametres/")({
  beforeLoad: () => {
    throw redirect({ href: "/app/parametres/organisation" });
  },
});
