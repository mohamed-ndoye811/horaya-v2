import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BrandBand, PublicNav } from "@/components/public/public-chrome";
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
    <>
      <BrandBand>
        <PublicNav workspace={workspace} />
        <div className="px-5 pt-10 pb-10 sm:px-16 sm:pt-14 sm:pb-14">
          <h1
            className={cn(
              "text-[52px] leading-[48px] sm:text-[96px] sm:leading-[88px]",
              displayFontClass(workspace.displayFont),
            )}
          >
            Mentions légales
          </h1>
        </div>
      </BrandBand>
      <div className="flex max-w-[720px] flex-col gap-10 px-5 py-10 sm:px-16 sm:py-14">
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
    </>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="border-b-2 border-ink pb-2.5 font-section text-section leading-7 text-ink">
        {title}
      </h2>
      <div className="flex flex-col gap-1 text-base font-medium leading-7 text-ink-muted">
        {children}
      </div>
    </section>
  );
}
