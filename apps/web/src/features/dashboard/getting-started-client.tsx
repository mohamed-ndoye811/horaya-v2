import { useEffect, useState } from "react";
import { GuidedTour, rememberTour, tourDismissed } from "@/components/app/guided-tour";
import { Button } from "@/components/ui/button";
import { cardShellClasses } from "@/components/ui/section";
import { cn } from "@/lib/cn";

/** Carte « Fais le tour en 1 minute » (maquette 4.7) ; se masque après la visite ou « Plus tard ». */
export function TourCard() {
  const [hidden, setHidden] = useState(true);
  const [touring, setTouring] = useState(false);
  // Lu après le premier rendu : le stockage n'existe que dans le navigateur.
  useEffect(() => setHidden(tourDismissed()), []);
  if (hidden && !touring) return null;
  return (
    <section className={cn(cardShellClasses, "gap-3.5 p-6 max-lg:hidden")}>
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-xl bg-accent/15 text-accent-strong"
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="m15.5 8.5-2 5-5 2 2-5 5-2z" />
          </svg>
        </span>
        <h2 className="text-[17px] font-semibold leading-[22px] text-ink">
          Fais le tour en 1 minute
        </h2>
      </div>
      <p className="text-sm leading-5 text-ink-muted">
        Le notch, les actions de chaque page, l'enregistrement : 4 étapes pour prendre tes repères.
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setTouring(true)}>
          Lancer la visite
        </Button>
        <button
          type="button"
          onClick={() => {
            rememberTour("plus-tard");
            setHidden(true);
          }}
          className="h-10 px-3.5 text-sm font-semibold text-ink-subtle hover:text-ink"
        >
          Plus tard
        </button>
      </div>
      {touring && (
        <GuidedTour
          onClose={() => {
            setTouring(false);
            setHidden(true);
          }}
        />
      )}
    </section>
  );
}

/** « Copier » l'adresse de la page publique. */
export function CopyPublicLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      size="xs"
      onClick={async () => {
        await navigator.clipboard.writeText(`${window.location.origin}/${slug}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Copié" : "Copier"}
    </Button>
  );
}
