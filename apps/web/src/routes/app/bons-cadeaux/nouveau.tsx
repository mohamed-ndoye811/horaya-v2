import { createFileRoute, redirect } from "@tanstack/react-router";

/** Ancienne page de vente : la vente se fait dans une fenêtre, sur la liste des bons. */
export const Route = createFileRoute("/app/bons-cadeaux/nouveau")({
  beforeLoad: () => {
    throw redirect({ href: "/app/bons-cadeaux?vendre=1" });
  },
});
