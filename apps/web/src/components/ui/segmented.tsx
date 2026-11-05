"use client";

import Link from "next/link";
import { type ReactNode, useId, useState } from "react";
import { ActiveIndicator } from "@/components/motion/indicator";
import { cn } from "@/lib/cn";

interface Segment {
  value: string;
  label: ReactNode;
  /** Compteur après le libellé (« Toutes 156 »). */
  count?: number;
  /** Compteur à traiter (« En attente 3 ») : pastille ambre. */
  alert?: boolean;
}

// DA v4 : rail blanc en pilule, segment actif noir.
const groupClasses = (size: "sm" | "md", fill: boolean) =>
  cn(
    "flex gap-1 rounded-full bg-surface p-1",
    size === "md" ? "h-11" : "h-10",
    fill ? "w-full" : "w-fit",
  );

// Le fond du segment actif est un repère qui glisse d'un segment à l'autre (ActiveIndicator).
const segmentClasses = (active: boolean, fill: boolean) =>
  cn(
    "relative isolate flex items-center justify-center gap-[7px] whitespace-nowrap rounded-full text-sm font-semibold leading-[18px] transition-colors",
    // Pleine largeur : segments égaux, marge réduite pour tenir sur un petit écran.
    fill ? "flex-1 basis-0 px-2" : "px-4",
    active ? "text-on-ink" : "text-ink hover:bg-field",
  );

const indicator = "inset-0 -z-10 rounded-full bg-ink";

function SegmentContent({ segment, active }: { segment: Segment; active: boolean }) {
  return (
    <>
      {segment.label}
      {segment.count !== undefined &&
        (segment.alert && segment.count > 0 && !active ? (
          <span className="flex h-[18px] items-center rounded-full bg-warning-bg px-1.5 text-[11px] font-bold leading-[14px] text-warning">
            {segment.count}
          </span>
        ) : (
          <span
            className={cn(
              "text-xs font-semibold leading-4",
              active ? "text-on-ink/55" : "text-ink-subtle",
            )}
          >
            {segment.count}
          </span>
        ))}
    </>
  );
}

/**
 * Filtres ou vues sous forme de liens (« Toutes / En attente / Confirmées »).
 * `collapse` : sous 768 px, pilules qui défilent à l'horizontale à la place des segments
 * (maquette 6.2), qui débordaient de l'écran (filtres de listes à 4 ou 5 entrées).
 */
export function SegmentedLinks({
  segments,
  value,
  label,
  size = "md",
  fill = false,
  collapse = false,
}: {
  segments: Array<Segment & { href: string }>;
  value: string;
  /** Nom du groupe pour les lecteurs d'écran. */
  label: string;
  size?: "sm" | "md";
  fill?: boolean;
  collapse?: boolean;
}) {
  const id = useId();
  const links = (
    <nav aria-label={label} className={groupClasses(size, fill)}>
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <Link
            key={segment.value}
            href={segment.href}
            aria-current={active ? "page" : undefined}
            className={segmentClasses(active, fill)}
          >
            {active && <ActiveIndicator id={id} className={indicator} />}
            <SegmentContent segment={segment} active={active} />
          </Link>
        );
      })}
    </nav>
  );
  if (!collapse) return links;
  return (
    <>
      <nav
        aria-label={label}
        className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] md:hidden"
      >
        {segments.map((segment) => {
          const active = segment.value === value;
          return (
            <Link
              key={segment.value}
              href={segment.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold leading-[18px]",
                active ? "bg-ink text-on-ink" : "bg-surface text-ink",
              )}
            >
              <SegmentContent segment={segment} active={active} />
            </Link>
          );
        })}
      </nav>
      <div className="hidden md:block">{links}</div>
    </>
  );
}

/** Choix exclusif dans un formulaire (« Public / Sur invitation »). Contrôlé ou non. */
export function SegmentedControl({
  segments,
  name,
  label,
  value,
  defaultValue,
  onChange,
  size = "sm",
  fill = true,
}: {
  segments: Segment[];
  name: string;
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  size?: "sm" | "md";
  fill?: boolean;
}) {
  const id = useId();
  const [own, setOwn] = useState(defaultValue);
  const selected = value ?? own;
  return (
    <div role="radiogroup" aria-label={label} className={groupClasses(size, fill)}>
      {segments.map((segment) => {
        const inputId = `${id}-${segment.value}`;
        const active = selected === segment.value;
        return (
          <label
            key={segment.value}
            htmlFor={inputId}
            className={cn(
              segmentClasses(active, fill),
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink",
            )}
          >
            {active && <ActiveIndicator id={id} className={indicator} />}
            <input
              id={inputId}
              type="radio"
              name={name}
              value={segment.value}
              className="sr-only"
              checked={active}
              onChange={() => {
                setOwn(segment.value);
                onChange?.(segment.value);
              }}
            />
            <SegmentContent segment={segment} active={active} />
          </label>
        );
      })}
    </div>
  );
}
