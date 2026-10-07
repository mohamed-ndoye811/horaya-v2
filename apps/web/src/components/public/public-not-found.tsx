import Link from "next/link";
import { ArrowLeft } from "@/components/ui/icons";

/** Écran 28b : page introuvable, en version admin (global) ou publique (dans un espace). */
export function NotFoundScreen({
  title = "Cette page a quitté l'agenda.",
  text = "Le lien est peut-être expiré, ou l'événement a été supprimé par son organisateur.",
  primary,
  secondary,
  wordmark = true,
}: {
  title?: string;
  text?: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
  wordmark?: boolean;
}) {
  return (
    <div className="flex min-h-[640px] flex-1 flex-col bg-ink text-on-ink">
      {wordmark && (
        <div className="flex items-center justify-between gap-4 border-b border-on-ink/25 px-5 py-6 sm:px-16 sm:py-8">
          <Link href="/" className="font-headline text-[36px] leading-9">
            Horaya
          </Link>
          <span className="hidden font-mono text-label font-semibold uppercase tracking-[0.055em] opacity-75 sm:inline">
            Erreur 404 · page introuvable
          </span>
        </div>
      )}
      <div className="flex flex-1 items-end justify-between gap-16 px-5 pt-12 pb-12 sm:px-16 sm:pb-[72px]">
        <div className="flex flex-col gap-7">
          <p
            aria-hidden="true"
            className="font-headline text-[160px] leading-[130px] sm:text-[380px] sm:leading-[300px]"
          >
            404
          </p>
          <h1 className="font-headline text-[36px] leading-9 sm:text-[56px] sm:leading-[52px]">
            {title}
          </h1>
          <p className="max-w-[560px] text-[17px] font-medium leading-7 opacity-85 sm:text-[19px]">
            {text}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={primary.href}
              className="flex h-[54px] items-center justify-center gap-2.5 bg-on-ink px-6 text-base font-extrabold text-ink transition-opacity hover:opacity-90"
            >
              <ArrowLeft />
              {primary.label}
            </Link>
            {secondary && (
              <Link
                href={secondary.href}
                className="flex h-[54px] items-center justify-center border-2 border-on-ink px-[22px] text-base font-bold transition-colors hover:bg-on-ink/10"
              >
                {secondary.label}
              </Link>
            )}
          </div>
        </div>
        <div aria-hidden="true" className="hidden flex-col gap-2.5 sm:flex">
          {["bg-cat-seminaire", "bg-cat-atelier", "bg-cat-reunion", "bg-cat-meetup"].map(
            (color) => (
              <span key={color} className={`size-6 ${color}`} />
            ),
          )}
        </div>
      </div>
    </div>
  );
}
