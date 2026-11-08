import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { PassBalanceCard } from "@/components/pass-balance-card";
import { CustomerHomePage } from "@/features/customer-space/home-page";
import { AbsenceButton, EnrollmentProgress } from "@/features/enrollments/enrollment-progress";
import { MyGiftCards } from "@/features/gift-cards/my-gift-cards";
import {
  getCustomerHome,
  getMyGiftCards,
  reportCustomerAbsenceAction,
} from "@/functions/customer-space";
import { getMyPassSummary } from "@/functions/passes";

const layout = getRouteApi("/$slug");

/** Maquettes 8.2 et 8.6 : accueil de l'espace client chez un atelier. */
export const Route = createFileRoute("/$slug/mon-espace/")({
  loader: async ({ params }) => {
    const [home, { passes }, giftCards] = await Promise.all([
      getCustomerHome({ data: params.slug }),
      getMyPassSummary({ data: params.slug }),
      getMyGiftCards({ data: params.slug }),
    ]);
    return { home, passes, giftCards };
  },
  head: () => ({ meta: [{ title: "Mon espace" }, { name: "robots", content: "noindex" }] }),
  component: CustomerHome,
});

function CustomerHome() {
  const workspace = layout.useLoaderData();
  const { home, passes, giftCards } = Route.useLoaderData();
  const next = home.upcoming[0];
  // Collé au prochain rendez-vous s'il est une séance de la série, sinon carte à part à droite.
  const nextSeries = next?.series ?? null;
  const otherSeries = nextSeries ? null : home.upcoming.find((card) => card.series)?.series;
  const remaining = passes.reduce((total, pass) => total + pass.remaining, 0);
  return (
    <CustomerHomePage
      workspace={workspace}
      data={home}
      slots={{
        term: nextSeries && (
          <EnrollmentProgress progress={nextSeries.progress} timeZone={workspace.timezone} />
        ),
        nextActions: next?.enrollmentId && next.eventId && next.startsAt && (
          <AbsenceButton
            session={{ eventId: next.eventId, title: next.title, startsAt: next.startsAt }}
            timeZone={workspace.timezone}
            onAbsent={() => reportCustomerAbsenceAction(workspace.slug, next.id)}
          />
        ),
        aside: (passes.length > 0 || giftCards.length > 0 || otherSeries) && (
          <>
            {otherSeries && (
              <EnrollmentProgress
                progress={otherSeries.progress}
                timeZone={workspace.timezone}
                wide
              />
            )}
            {passes.map((pass) => (
              <PassBalanceCard key={pass.id} pass={pass} timeZone={workspace.timezone} />
            ))}
            <MyGiftCards cards={giftCards} timeZone={workspace.timezone} />
          </>
        ),
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
