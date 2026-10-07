import Link from "next/link";
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
              "flex shrink-0 items-center gap-2 border-b-4 pt-[18px] pb-3.5 text-[15px] leading-5 transition-colors",
              active
                ? "border-ink font-extrabold text-ink"
                : "border-transparent font-semibold text-ink-muted hover:text-ink",
            )}
          >
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
