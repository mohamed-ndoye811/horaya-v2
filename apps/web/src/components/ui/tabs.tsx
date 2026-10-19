"use client";

import Link from "next/link";
import { ActiveIndicator } from "@/components/motion/indicator";
import { cn } from "@/lib/cn";
import { CountBadge } from "./badge";

/** Onglets soulignés (fiche événement : Participants, Infos, Matériel…). */
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
    <nav aria-label={label} className="flex gap-8 overflow-x-auto">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <Link
            key={tab.value}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex shrink-0 items-center gap-2 pt-[18px] pb-[18px] text-[15px] leading-5 transition-colors",
              active ? "font-extrabold text-ink" : "font-semibold text-ink-muted hover:text-ink",
            )}
          >
            {active && (
              <ActiveIndicator id={`tabs-${label}`} className="inset-x-0 bottom-0 h-1 bg-ink" />
            )}
            {tab.label}
            {tab.count !== undefined &&
              (active ? (
                <CountBadge>{tab.count}</CountBadge>
              ) : (
                <span className="font-mono text-label font-semibold text-ink-muted">
                  {tab.count}
                </span>
              ))}
          </Link>
        );
      })}
    </nav>
  );
}
