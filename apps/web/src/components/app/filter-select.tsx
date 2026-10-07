"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";

/** Liste déroulante de filtre : change le paramètre d'URL dès qu'on choisit. */
export function FilterSelect({
  param,
  label,
  options,
  className,
}: {
  param: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <Select
      variant="filter"
      aria-label={label}
      className={className}
      value={searchParams.get(param) ?? ""}
      onChange={(event) => {
        const next = new URLSearchParams(searchParams);
        if (event.target.value) next.set(param, event.target.value);
        else next.delete(param);
        router.push(`${pathname}?${next.toString()}`);
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}
