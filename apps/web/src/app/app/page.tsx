import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CategorySquares } from "@/components/auth/auth-shell";
import { listMyWorkspaces, requireSession } from "@/server/auth";
import { SignOutButton, VerifyEmailBanner } from "./account-actions";

export const metadata: Metadata = { title: "Mon espace · Horaya" };

/** Accueil provisoire de l'admin : le tableau de bord complet arrive avec les écrans admin. */
export default async function AppHomePage() {
  const { user, session } = await requireSession();
  const workspaces = await listMyWorkspaces();
  const workspace =
    workspaces.find((candidate) => candidate.id === session.activeOrganizationId) ?? workspaces[0];
  if (!workspace) redirect("/inscription/espace");

  const firstName = user.firstName || user.name.split(" ")[0] || "";

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 bg-ink px-4 py-4 text-on-ink sm:px-10">
        <div className="flex min-w-0 items-center gap-5">
          <span className="font-headline text-[32px] leading-8">Horaya</span>
          <span className="truncate border-l border-on-ink/30 pl-5 text-sm font-bold uppercase tracking-[0.02em]">
            {workspace.name}
          </span>
        </div>
        <SignOutButton />
      </header>

      <main className="flex flex-1 flex-col gap-10 px-4 py-10 sm:px-10 lg:py-16">
        {!user.emailVerified && <VerifyEmailBanner email={user.email} />}

        <div className="flex max-w-3xl flex-col gap-4">
          <p className="font-mono text-label font-semibold uppercase tracking-[0.055em] text-neutral">
            Ton espace est prêt
          </p>
          <h1 className="font-headline text-[56px] leading-[52px] sm:text-display sm:leading-[60px]">
            Bonjour {firstName}.
          </h1>
          <p className="max-w-xl text-lg font-medium leading-7 text-ink-muted">
            Bienvenue dans {workspace.name}. Ton agenda, tes événements et ton matériel arrivent ici
            très bientôt.
          </p>
        </div>

        <dl className="grid max-w-3xl gap-px border-[1.5px] border-line-soft bg-line-soft sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 bg-surface p-5">
            <dt className="font-mono text-label font-semibold uppercase tracking-[0.055em] text-neutral">
              Page publique
            </dt>
            <dd className="font-mono text-base font-semibold text-ink">
              horaya.app/{workspace.slug}
            </dd>
          </div>
          <div className="flex flex-col gap-1.5 bg-surface p-5">
            <dt className="font-mono text-label font-semibold uppercase tracking-[0.055em] text-neutral">
              Connecté en tant que
            </dt>
            <dd className="truncate text-base font-semibold text-ink">{user.email}</dd>
          </div>
        </dl>

        <div className="mt-auto">
          <CategorySquares />
        </div>
      </main>
    </div>
  );
}
