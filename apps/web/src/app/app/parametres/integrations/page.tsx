import type { Metadata } from "next";
import { SettingsShell } from "@/components/app/settings-shell";

export const metadata: Metadata = { title: "Intégrations · Horaya" };

export default function IntegrationsSettingsPage() {
  return (
    <SettingsShell section="integrations" breadcrumb="Intégrations">
      <div className="flex max-w-[640px] flex-col gap-3 border-2 border-dashed border-ink-subtle px-6 py-8">
        <p className="font-section text-section leading-7 text-ink">Bientôt</p>
        <p className="text-base font-medium leading-6 text-ink-muted">
          Les intégrations arriveront avec l'API publique d'Horaya : tu pourras relier tes
          réservations à tes autres outils.
        </p>
      </div>
    </SettingsShell>
  );
}
