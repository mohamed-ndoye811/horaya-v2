import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cn } from "@/lib/cn";
import { displayFontClass } from "@/lib/fonts";
import { param } from "@/lib/search-params";
import { getWorkspaceBySlug } from "@/server/public";
import { RequestLinksForm } from "./request-links-form";

export const metadata: Metadata = { title: "Mes réservations", robots: { index: false } };

/** Pas de compte client : on retrouve ses réservations par e-mail. */
export default async function MyBookingsPage({
  params,
  searchParams,
}: PageProps<"/[slug]/mes-reservations">) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  return (
    <div className="flex flex-col gap-4 lg:min-h-[640px] lg:flex-row">
      <section className="flex flex-1 flex-col items-center justify-center rounded-3xl bg-surface px-6 py-10 sm:p-12">
        <div className="flex w-full max-w-[440px] flex-col gap-[22px]">
          <div className="flex flex-col gap-2">
            <h1
              className={cn(
                "text-[36px] leading-10 tracking-[-0.035em] text-ink sm:text-kpi sm:leading-[48px]",
                displayFontClass(workspace.displayFont),
              )}
            >
              Mes réservations
            </h1>
            <p className="text-base leading-6 text-ink-muted">
              Pas de compte à créer : entre l'adresse utilisée pour réserver, on t'envoie un lien
              vers chacune de tes réservations.
            </p>
          </div>
          <RequestLinksForm slug={slug} email={param((await searchParams).email) ?? ""} />
        </div>
      </section>
      <aside
        className="hidden w-[400px] shrink-0 flex-col justify-end gap-3 rounded-3xl p-8 lg:flex"
        style={{
          background:
            "radial-gradient(circle at 70% 15%, color-mix(in srgb, var(--brand) 55%, transparent), transparent 65%), var(--color-ink)",
        }}
      >
        <p className="text-[13px] font-semibold leading-4 text-[var(--brand-light)]">
          Dans l'e-mail
        </p>
        <p className="text-[15px] leading-[23px] text-white">
          Un lien par réservation : tu y retrouves ton récapitulatif, le paiement, l'ajout à ton
          agenda et l'annulation. Les nouveaux liens remplacent ceux reçus avant.
        </p>
      </aside>
    </div>
  );
}
