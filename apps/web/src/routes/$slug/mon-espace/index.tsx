import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { PassBalanceCard } from "@/components/pass-balance-card";
import { CustomerHomePage } from "@/features/customer-space/home-page";
import { AbsenceButton, EnrollmentProgress } from "@/features/enrollments/enrollment-progress";
import {
  getCustomerHome,
  getCustomerTerm,
  reportCustomerAbsenceAction,
} from "@/functions/customer-space";
import { getMyPassSummary } from "@/functions/passes";

const layout = getRouteApi("/$slug");

/** Maquettes 8.2 et 8.6 : accueil de l'espace client chez un atelier. */
export const Route = createFileRoute("/$slug/mon-espace/")({
  loader: async ({ params }) => {
    const [home, term, { passes }] = await Promise.all([
      getCustomerHome({ data: params.slug }),
      getCustomerTerm({ data: params.slug }),
      getMyPassSummary({ data: params.slug }),
    ]);
    return { home, term, passes };
  },
  head: () => ({ meta: [{ title: "Mon espace" }, { name: "robots", content: "noindex" }] }),
  component: CustomerHome,
});

function CustomerHome() {
  const workspace = layout.useLoaderData();
  const { home, term, passes } = Route.useLoaderData();
  const next = home.upcoming[0];
  const remaining = passes.reduce((total, pass) => total + pass.remaining, 0);
  return (
    <CustomerHomePage
      workspace={workspace}
      data={home}
      slots={{
        term: term && <EnrollmentProgress progress={term.progress} timeZone={workspace.timezone} />,
        nextActions: next?.enrollmentId && next.eventId && next.startsAt && (
          <AbsenceButton
            session={{ eventId: next.eventId, title: next.title, startsAt: next.startsAt }}
            timeZone={workspace.timezone}
            onAbsent={() => reportCustomerAbsenceAction(workspace.slug, next.id)}
          />
        ),
        aside:
          passes.length > 0 &&
          passes.map((pass) => (
            <PassBalanceCard key={pass.id} pass={pass} timeZone={workspace.timezone} />
          )),
        barMessage: passes.length > 0 && (
          <>
            <strong>
              {remaining} séance{remaining > 1 ? "s" : ""}
            </strong>{" "}
            sur ta carte
          </>
        ),
      }}
    />
  );
}
