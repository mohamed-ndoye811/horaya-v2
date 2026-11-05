"use client";

import Link from "next/link";
import { ActiveIndicator } from "@/components/motion/indicator";
import { cn } from "@/lib/cn";

/**
 * Onglets d'une fiche (Participants, Matériel, Infos) : rail blanc en pilule, onglet actif
 * noir avec son compteur (DA v4).
 */
export function Tabs({
  tabs,
  value,
  label,
}: {
  tabs: Array<{ value: string; label: string; href: string; count?: number }>;
  value: string;
  label: string;
}) {
  return (
    <nav
      aria-label={label}
      className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-surface p-1"
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <Link
            key={tab.value}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative isolate flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold leading-[18px] transition-colors",
              active ? "text-on-ink" : "text-ink hover:bg-field",
            )}
          >
            {active && (
              <ActiveIndicator id={`tabs-${label}`} className="inset-0 -z-10 rounded-full bg-ink" />
            )}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  "font-mono text-label font-semibold",
                  active ? "text-on-ink/70" : "text-ink-muted",
                )}
              >
                {tab.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
