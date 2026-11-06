import { createFileRoute } from "@tanstack/react-router";
import { exportCustomersCsv } from "@/server/clients";

/** Export CSV des clients, avec les filtres en cours (session obligatoire). */
export const Route = createFileRoute("/app/clients/export")({
  server: { handlers: { GET: ({ request }) => exportCustomersCsv(request) } },
});
