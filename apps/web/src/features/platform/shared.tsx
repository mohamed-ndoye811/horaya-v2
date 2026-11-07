import { type CurrentPlan, PLANS } from "@horaya/core";
import { StatusBadge, type Tone } from "@/components/ui/badge";
import { SegmentedLinks } from "@/components/ui/segmented";

/** Onglets du cockpit. */
export function PlatformTabs({ value }: { value: "espaces" | "comptes" }) {
  return (
    <SegmentedLinks
      label="Sections du cockpit"
      value={value}
      segments={[
        { value: "espaces", label: "Espaces", href: "/app/plateforme" },
        { value: "comptes", label: "Comptes", href: "/app/plateforme/utilisateurs" },
      ]}
    />
  );
}

const SOURCES: Record<CurrentPlan["source"], { label: string; tone: Tone }> = {
  free: { label: "gratuit", tone: "neutral" },
  subscription: { label: "abonné", tone: "success" },
  trial: { label: "essai", tone: "info" },
  beta: { label: "bêta-testeur", tone: "success" },
  gift: { label: "offerte", tone: "success" },
};

/** Formule et origine (« Pro · essai »). */
export function PlanBadge({ current }: { current: Pick<CurrentPlan, "plan" | "source"> }) {
  const source = SOURCES[current.source];
  return (
    <StatusBadge tone={source.tone} size="sm">
      {PLANS[current.plan].name} · {source.label}
    </StatusBadge>
  );
}

export const shortDay = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(
    date,
  );
