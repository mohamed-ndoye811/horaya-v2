import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandBand, PublicNav } from "@/components/public/public-chrome";
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
    <>
      <BrandBand>
        <PublicNav workspace={workspace} active="bookings" />
        <div className="flex flex-col gap-5 px-5 pt-10 pb-10 sm:px-16 sm:pt-14 sm:pb-14">
          <h1
            className={cn(
              "text-[52px] leading-[48px] sm:text-[96px] sm:leading-[88px]",
              displayFontClass(workspace.displayFont),
            )}
          >
            Mes réservations
          </h1>
          <p className="max-w-[620px] text-lg font-medium leading-7 opacity-90">
            Pas besoin de compte : indique l'adresse e-mail utilisée pour réserver, on t'envoie le
            lien de chacune de tes réservations à venir.
          </p>
        </div>
      </BrandBand>
      <div className="px-5 py-10 sm:px-16 sm:py-14">
        <RequestLinksForm slug={slug} email={param((await searchParams).email) ?? ""} />
      </div>
    </>
  );
}
