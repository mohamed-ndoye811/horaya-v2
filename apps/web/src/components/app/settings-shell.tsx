import Link from "next/link";
import type { ReactNode } from "react";
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
 * Écrans 24 à 26 : en-tête « Paramètres », sous-navigation à gauche, contenu. Sur mobile
 * (M23 à M25), le titre est celui de la section et la sous-navigation passe par « Plus ».
 */
export function SettingsShell({
  section,
  breadcrumb,
  subtitle,
  actions,
  children,
}: {
  section: SettingsSection;
  breadcrumb: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh min-w-0 flex-col">
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
        stickyActions="above-tabs"
      />
      <div className="flex min-w-0 flex-1 flex-col lg:flex-row">
        <nav
          aria-label="Sections des paramètres"
          className="hidden shrink-0 lg:flex lg:w-[232px] lg:flex-col lg:border-r lg:border-line-soft lg:py-6"
        >
          {SECTIONS.map((entry) => {
            const active = entry.value === section;
            return (
              <Link
                key={entry.value}
                href={entry.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 whitespace-nowrap px-4 py-3 text-[15px] leading-5 text-ink transition-colors lg:py-2.5 lg:pr-6",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink",
                  active
                    ? "border-b-4 border-ink bg-surface font-extrabold lg:border-b-0 lg:border-l-4 lg:pl-9"
                    : "font-semibold hover:bg-draft-bg lg:pl-10",
                )}
              >
                {entry.label}
              </Link>
            );
          })}
        </nav>
        <div className="min-w-0 flex-1 px-4 py-8 sm:px-10">
          {children}
          {/* Place de la barre d'actions collée en bas sur mobile. */}
          {actions && <div aria-hidden="true" className="h-20 lg:hidden" />}
        </div>
      </div>
    </div>
  );
}
