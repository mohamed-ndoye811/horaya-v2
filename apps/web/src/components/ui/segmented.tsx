"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useId } from "react";
import { cn } from "@/lib/cn";
import { Select } from "./select";

interface Segment {
  value: string;
  label: ReactNode;
  /** Compteur en mono après le libellé (« Toutes 156 »). */
  count?: number;
}

const groupClasses = (size: "sm" | "md", fill: boolean) =>
  cn("flex border-2 border-ink", size === "md" ? "h-12" : "h-10", fill ? "w-full" : "w-fit");

const segmentClasses = (active: boolean, fill: boolean) =>
  cn(
    "flex items-center justify-center gap-2 whitespace-nowrap px-[18px] text-sm font-bold leading-[18px] transition-colors",
    "[&:not(:first-child)]:border-l-2 [&:not(:first-child)]:border-ink",
    fill && "flex-1 basis-0",
    active ? "bg-ink text-on-ink" : "text-ink hover:bg-surface",
  );

function SegmentContent({ segment, active }: { segment: Segment; active: boolean }) {
  return (
    <>
      {segment.label}
      {segment.count !== undefined && (
        <span
          className={cn(
            "font-mono text-label font-semibold leading-4",
            active ? "text-on-ink/70" : "text-ink-muted",
          )}
        >
          {segment.count}
        </span>
      )}
    </>
  );
}

/**
 * Filtres ou vues sous forme de liens (« Toutes / En attente / Confirmées »).
 * `collapse` : sous 768 px, liste déroulante native à la place des segments, qui
 * débordaient de l'écran (filtres de listes à 4 ou 5 entrées).
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
  const router = useRouter();
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
            <SegmentContent segment={segment} active={active} />
          </Link>
        );
      })}
    </nav>
  );
  if (!collapse) return links;
  return (
    <>
      <div className="md:hidden">
        <Select
          variant="filter"
          aria-label={label}
          value={value}
          onChange={(event) => {
            const target = segments.find((segment) => segment.value === event.target.value);
            if (target) router.push(target.href);
          }}
        >
          {segments.map((segment) => (
            <option key={segment.value} value={segment.value}>
              {typeof segment.label === "string" ? segment.label : segment.value}
              {segment.count !== undefined ? ` · ${segment.count}` : ""}
            </option>
          ))}
        </Select>
      </div>
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
  return (
    <div role="radiogroup" aria-label={label} className={groupClasses(size, fill)}>
      {segments.map((segment) => {
        const inputId = `${id}-${segment.value}`;
        const checked = value !== undefined ? value === segment.value : undefined;
        return (
          <label
            key={segment.value}
            htmlFor={inputId}
            className={cn(
              segmentClasses(false, fill),
              "has-checked:bg-ink has-checked:text-on-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink",
            )}
          >
            <input
              id={inputId}
              type="radio"
              name={name}
              value={segment.value}
              className="sr-only"
              {...(checked !== undefined
                ? { checked, onChange: () => onChange?.(segment.value) }
                : { defaultChecked: defaultValue === segment.value })}
            />
            <SegmentContent segment={segment} active={false} />
          </label>
        );
      })}
    </div>
  );
}
