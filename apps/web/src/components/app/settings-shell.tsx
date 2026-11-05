import Link from "next/link";
import type { ReactNode } from "react";
import { ActionBar } from "@/components/ui/action-bar";
import { cardShellClasses } from "@/components/ui/section";
import { cn } from "@/lib/cn";
import { PageHeader } from "./page-header";

export type SettingsSection = "profil" | "organisation" | "membres" | "paiements" | "integrations";

const SECTIONS: Array<{ value: SettingsSection | "notifications"; label: string; href: string }> = [
  { value: "profil", label: "Profil", href: "/app/parametres/profil" },
  { value: "organisation", label: "Organisation & marque", href: "/app/parametres/organisation" },
  { value: "membres", label: "Membres & rôles", href: "/app/parametres/membres" },
  { value: "paiements", label: "Paiements", href: "/app/parametres/paiements" },
  // Les notifications sont réglées sur la même page que les paiements (écran 26).
  {
    value: "notifications",
    label: "Notifications",
    href: "/app/parametres/paiements#notifications",
  },
  { value: "integrations", label: "Intégrations", href: "/app/parametres/integrations" },
];

/**
 * Paramètres (DA v4, maquettes 3.1 à 3.7) : en-tête « Paramètres », menu des sections dans
 * une carte à gauche, contenu, et barre noire d'enregistrement en bas (`saveBar`). Les
 * actions d'en-tête (`actions`) vont dans le coin du notch. Sur mobile, le titre est celui
 * de la section et le menu passe par « Plus ».
 */
export function SettingsShell({
  section,
  breadcrumb,
  subtitle,
  actions,
  saveBar,
  children,
}: {
  section: SettingsSection;
  breadcrumb: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Boutons d'enregistrement (souvent `form="…"`) et phrase de contexte. */
  saveBar?: { message?: ReactNode; buttons: ReactNode };
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <PageHeader
        eyebrow={`Paramètres / ${breadcrumb}`}
        title={
          <>
            <span className="lg:hidden">{breadcrumb}</span>
            <span className="hidden lg:inline">Paramètres</span>
          </>
        }
        subtitle={subtitle}
        actions={actions}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-4 px-4 pb-4 lg:flex-row lg:items-start">
        <nav
          aria-label="Sections des paramètres"
          className={cn(
            cardShellClasses,
            "hidden shrink-0 gap-0.5 p-2 lg:sticky lg:top-4 lg:flex lg:w-[232px]",
          )}
        >
          {SECTIONS.map((entry) => {
            const active = entry.value === section;
            return (
              <Link
                key={entry.value}
                href={entry.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center justify-between gap-2 rounded-[14px] px-3.5 text-sm leading-[18px] transition-colors",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink",
                  active
                    ? "bg-ink font-semibold text-white"
                    : "font-medium text-ink hover:bg-field",
                )}
              >
                {entry.label}
                {entry.value === "integrations" && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-bold leading-[14px]",
                      active ? "bg-white/15 text-white" : "bg-field text-ink-subtle",
                    )}
                  >
                    Bientôt
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {children}
          {saveBar && (
            <>
              <ActionBar aboveTabs message={saveBar.message}>
                {saveBar.buttons}
              </ActionBar>
              {/* Place de la barre collée en bas sur mobile. */}
              <div aria-hidden="true" className="h-20 lg:hidden" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
