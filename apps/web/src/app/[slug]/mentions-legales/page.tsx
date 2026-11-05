import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { displayFontClass } from "@/lib/fonts";
import { getWorkspaceBySlug } from "@/server/public";

export const metadata: Metadata = { title: "Mentions légales" };

/** Mentions légales de la page publique : éditeur (l'organisateur) et hébergeur. */
export default async function LegalNoticePage({ params }: PageProps<"/[slug]/mentions-legales">) {
  const workspace = await getWorkspaceBySlug((await params).slug);
  if (!workspace) notFound();
  const siret = workspace.siret?.replace(/^(\d{3})(\d{3})(\d{3})(\d{5})$/, "$1 $2 $3 $4");

  return (
    <div className="flex flex-col gap-6">
      <h1
        className={cn(
          "px-1 pt-4 text-[40px] leading-[44px] tracking-[-0.04em] text-ink sm:text-[52px] sm:leading-[56px]",
          displayFontClass(workspace.displayFont),
        )}
      >
        Mentions légales
      </h1>
      <div className="flex max-w-[760px] flex-col gap-4">
        <Block title="Éditeur de la page">
          <p className="font-bold text-ink">{workspace.legalName ?? workspace.name}</p>
          {workspace.legalName && workspace.legalName !== workspace.name && (
            <p>Nom commercial : {workspace.name}</p>
          )}
          {siret && <p>SIRET : {siret}</p>}
          {workspace.address && <p className="whitespace-pre-line">{workspace.address}</p>}
          {workspace.contactEmail && (
            <p>
              E-mail :{" "}
              <a
                href={`mailto:${workspace.contactEmail}`}
                className="font-semibold text-ink underline underline-offset-[3px]"
              >
                {workspace.contactEmail}
              </a>
            </p>
          )}
          {workspace.contactPhone && <p>Téléphone : {workspace.contactPhone}</p>}
        </Block>
        <Block title="Réservation en ligne">
          <p>
            Les réservations de cette page passent par Horaya (horaya.app). Les données que tu
            saisis servent uniquement à {workspace.name} pour gérer ta réservation.
          </p>
        </Block>
        <Block title="Hébergement">
          <p>Infomaniak Network SA, rue Eugène-Marziano 25, 1227 Les Acacias (GE), Suisse.</p>
        </Block>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-surface p-6">
      <h2 className="text-xl font-semibold leading-6 text-ink">{title}</h2>
      <div className="flex flex-col gap-1 text-base leading-7 text-ink-muted">{children}</div>
    </section>
  );
}
