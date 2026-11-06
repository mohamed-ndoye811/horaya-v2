import { pingDatabase } from "@horaya/db";
import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/server/db";

/** Sonde Kubernetes : l'app répond et la base aussi. */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () =>
        (await pingDatabase(db))
          ? Response.json({ status: "ok" })
          : Response.json({ status: "database_unavailable" }, { status: 503 }),
    },
  },
});
