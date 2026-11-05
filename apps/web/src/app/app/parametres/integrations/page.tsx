import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SettingsShell } from "@/components/app/settings-shell";

export const metadata: Metadata = { title: "Intégrations · Horaya" };

const icon = (path: ReactNode) => (
  <svg
    aria-hidden="true"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {path}
  </svg>
);

const UPCOMING = [
  {
    title: "API publique",
    text: "Lis et crée des réservations depuis ton propre code.",
    icon: icon(<path d="m8 9-3 3 3 3M16 9l3 3-3 3" />),
  },
  {
    title: "Webhooks",
    text: "Préviens tes outils à chaque réservation ou paiement.",
    icon: icon(<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />),
  },
  {
    title: "Zapier & Make",
    text: "Automatise sans coder : tableur, CRM, messagerie.",
    icon: icon(
      <>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
      </>,
    ),
  },
];

/** Maquette 3.7 : intégrations, toutes à venir. */
export default function IntegrationsSettingsPage() {
  return (
    <SettingsShell
      section="integrations"
      breadcrumb="Intégrations"
      subtitle={
        <>
          Relie Horaya à tes autres outils. <span className="text-ink">Bientôt.</span>
        </>
      }
    >
      <section className="flex flex-wrap items-center gap-5 rounded-3xl border-[1.5px] border-dashed border-[#dcdcd8] bg-band px-7 py-6">
        <span className="flex size-[52px] shrink-0 items-center justify-center rounded-2xl bg-ink text-white">
          {icon(<path d="M12 22v-5M9 8V2M15 8V2M18 8v5a6 6 0 0 1-12 0V8Z" />)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="flex items-center gap-2.5 text-lg font-semibold leading-[22px] text-ink">
            Les intégrations arrivent
            <span className="rounded-full bg-info-bg px-2.5 py-0.5 text-[11px] font-bold leading-4 text-info">
              Bientôt
            </span>
          </h2>
          <p className="text-[13px] leading-5 text-ink-muted">
            Elles arriveront avec l'API publique d'Horaya : tu pourras relier tes réservations à tes
            autres outils.
          </p>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        {UPCOMING.map((entry) => (
          <section
            key={entry.title}
            className="flex flex-col gap-4 rounded-3xl bg-surface/70 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <div className="flex items-start justify-between">
              <span className="flex size-10 items-center justify-center rounded-xl bg-field text-ink-muted">
                {entry.icon}
              </span>
              <span className="rounded-full bg-field px-2.5 py-0.5 text-[11px] font-bold leading-4 text-ink-subtle">
                À venir
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-[15px] font-semibold leading-5 text-ink">{entry.title}</h3>
              <p className="text-[13px] leading-[17px] text-ink-subtle">{entry.text}</p>
            </div>
          </section>
        ))}
      </div>
      <p className="text-xs leading-4 text-ink-subtle">
        Tu as besoin d'un outil en particulier ?{" "}
        <a
          href="mailto:bonjour@horaya.app?subject=Intégration%20Horaya"
          className="font-semibold text-ink underline underline-offset-2"
        >
          Dis-le-nous
        </a>
        , ça nous aide à choisir l'ordre.
      </p>
    </SettingsShell>
  );
}
