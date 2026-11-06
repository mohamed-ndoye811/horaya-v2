import type { ReactNode } from "react";
import { HorayaWordmark } from "@/components/app/logo";
import { stagger, WordsReveal } from "@/components/motion/words";
import { cn } from "@/lib/cn";
import { Link } from "@/lib/navigation";
import { OnboardingSteps } from "./onboarding-steps";

/** Logo Horaya (lien vers l'accueil), en noir sur fond clair. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="Horaya" className={cn("text-ink", className)}>
      <HorayaWordmark height={22} />
    </Link>
  );
}

/** Deux cartes d'événements en bas du panneau noir (maquettes 4.1 à 4.6). */
function SampleEvents() {
  return (
    <div aria-hidden="true" className="reveal-group flex items-end gap-3.5">
      <div className="flex w-[250px] shrink-0 flex-col overflow-hidden rounded-[20px] bg-surface">
        <div
          className="h-[130px] bg-cover bg-center"
          style={{ backgroundImage: "url(/auth/atelier.jpg)" }}
        />
        <div className="flex flex-col gap-2 px-4 pt-3.5 pb-4">
          <p className="flex items-center gap-2 text-xs font-semibold text-ink-subtle">
            <span className="size-2 rounded-[3px] bg-cat-atelier" />
            Sam. 14 juin · 10 h
          </p>
          <p className="text-base font-semibold leading-5 text-ink">Atelier tournage</p>
          <div className="flex items-center gap-2.5">
            <span className="flex h-1 flex-1 rounded-full bg-[#ededeb]">
              <span className="h-1 w-3/4 rounded-full bg-ink" />
            </span>
            <span className="font-mono text-[11px] font-semibold text-ink">9 / 12</span>
          </div>
        </div>
      </div>
      <div className="hidden w-[250px] shrink-0 flex-col overflow-hidden rounded-[20px] bg-[#1c1c1c] xl:flex">
        <div
          className="h-[180px] bg-cover bg-center"
          style={{ backgroundImage: "url(/auth/seminaire.jpg)" }}
        />
        <div className="flex flex-col gap-2 px-4 pt-3.5 pb-4">
          <p className="flex items-center gap-2 text-xs font-semibold text-ink-subtle">
            <span className="size-2 rounded-[3px] bg-cat-seminaire" />
            Jeu. 19 juin · 9 h
          </p>
          <p className="text-base font-semibold leading-5 text-white">Séminaire Ardèche</p>
          <span className="w-fit rounded-full bg-success-bg px-[9px] py-[3px] text-[11px] font-bold leading-[14px] text-success">
            Complet
          </span>
        </div>
      </div>
    </div>
  );
}

/** Panneau de marque : grand titre, phrase et cartes d'exemple. */
export function BrandAside({
  title = (
    <>
      Planifie
      <br />
      avec style.
    </>
  ),
  lead = "Tes réservations, tes événements, ton matériel : dans un seul agenda, sous ta marque.",
}: {
  title?: ReactNode;
  lead?: ReactNode;
}) {
  return (
    <>
      <div className="flex flex-col gap-5">
        <p className="font-headline text-[clamp(52px,5vw,72px)] leading-[1] tracking-[-0.045em] text-white">
          <WordsReveal>{title}</WordsReveal>
        </p>
        <p
          className="reveal max-w-[440px] text-lg leading-[27px] text-[#9a9ea8]"
          style={stagger(3)}
        >
          {lead}
        </p>
      </div>
      <SampleEvents />
    </>
  );
}

/*
 * Notch des écrans de compte : plus étroit que celui de l'admin (logo seul), ou aussi large
 * quand il porte les étapes de l'inscription.
 */
const NOTCH = {
  logo: { width: 320, path: "M0 0 L0 6 C24 6 20 56 44 56 L276 56 C300 56 296 6 320 6 L320 0 Z" },
  steps: { width: 600, path: "M0 0 L0 6 C24 6 20 56 44 56 L556 56 C580 56 576 6 600 6 L600 0 Z" },
};

interface AuthShellProps {
  /** Contenu du panneau noir (accroche et cartes par défaut). */
  aside?: ReactNode;
  /** Lien sous le formulaire (« Pas encore de compte ? Créer un espace »). */
  topLink?: { prompt: string; label: string; href: string };
  footnote?: ReactNode;
  /** Largeur de la colonne de formulaire. */
  width?: "md" | "lg";
  /** Étape de l'inscription : affichée dans le notch. */
  step?: 1 | 2 | 3;
  children: ReactNode;
}

/**
 * Écrans de compte (DA v4, maquettes 4.1 à 4.6) : cadre noir et notch en haut au centre,
 * panneau de marque noir à gauche, formulaire centré à droite.
 */
export function AuthShell({
  aside = <BrandAside />,
  topLink,
  footnote,
  width = "md",
  step,
  children,
}: AuthShellProps) {
  const notch = step ? NOTCH.steps : NOTCH.logo;
  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:h-dvh lg:bg-ink lg:p-1.5">
      <div
        className="fixed top-0 left-1/2 z-50 hidden h-14 -translate-x-1/2 lg:block"
        style={{ width: notch.width }}
      >
        <svg
          aria-hidden="true"
          width={notch.width}
          height="56"
          viewBox={`0 0 ${notch.width} 56`}
          className="absolute -top-1.5 left-0"
        >
          <path d={notch.path} fill="#111111" />
        </svg>
        <div className="relative flex h-[50px] items-center justify-center text-on-ink">
          {step ? (
            <OnboardingSteps current={step} variant="notch" />
          ) : (
            <Link href="/" aria-label="Horaya">
              <HorayaWordmark height={20} />
            </Link>
          )}
        </div>
      </div>

      <div className="auth-fields flex flex-1 gap-4 lg:min-h-0 lg:overflow-y-auto lg:rounded-[10px] lg:bg-bg lg:px-4 lg:pt-[68px] lg:pb-4">
        <aside className="hidden w-[620px] max-w-[46%] shrink-0 flex-col justify-between gap-10 overflow-hidden rounded-3xl bg-ink p-10 lg:flex">
          {aside}
        </aside>

        <main className="flex flex-1 flex-col items-center justify-between gap-10 px-4 pt-6 pb-4 lg:pb-2">
          <div className="flex w-full items-center justify-between lg:h-px">
            <Wordmark className="lg:hidden" />
          </div>
          <div
            className={cn(
              "reveal flex w-full flex-col gap-6",
              width === "md" ? "max-w-[400px]" : "max-w-[440px]",
            )}
          >
            {step && (
              <div className="lg:hidden">
                <OnboardingSteps current={step} />
              </div>
            )}
            {children}
            {topLink && (
              <p className="flex flex-wrap justify-center gap-x-1.5 text-sm leading-[18px]">
                <span className="font-medium text-ink-muted">{topLink.prompt}</span>
                <Link
                  href={topLink.href}
                  className="font-bold text-ink underline underline-offset-2"
                >
                  {topLink.label}
                </Link>
              </p>
            )}
          </div>
          <div className="w-full max-w-[460px] text-center text-xs leading-[17px] text-ink-subtle">
            {footnote}
          </div>
        </main>
      </div>
    </div>
  );
}

/** Sur-titre discret (« Étape 1 sur 2 »). */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="reveal text-xs font-semibold leading-4 text-ink-subtle">{children}</p>;
}

export function AuthTitle({ children, size = "lg" }: { children: ReactNode; size?: "md" | "lg" }) {
  return (
    <h1
      className={cn(
        "font-headline text-ink",
        size === "lg"
          ? "text-[40px] leading-[44px] sm:text-[44px] sm:leading-[48px]"
          : "text-[36px] leading-10 sm:text-[40px] sm:leading-[44px]",
      )}
    >
      <WordsReveal delay={1}>{children}</WordsReveal>
    </h1>
  );
}

export function AuthLead({ children }: { children: ReactNode }) {
  return <p className="text-base leading-6 text-ink-muted">{children}</p>;
}
