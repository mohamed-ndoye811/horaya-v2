import { createFileRoute } from "@tanstack/react-router";
import { CounterPage } from "@/features/counter/counter-page";
import { counterSearch, getCounter } from "@/functions/counter";

export const Route = createFileRoute("/app/reservations/nouvelle")({
  validateSearch: counterSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getCounter({ data: deps }),
  head: () => ({ meta: [{ title: "Comptoir · Horaya" }] }),
  component: Counter,
});

function Counter() {
  return <CounterPage data={Route.useLoaderData()} initialEventId={Route.useSearch().evenement} />;
}
