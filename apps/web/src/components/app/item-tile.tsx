import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

/** Vignette d'un article : préfixe de sa référence (« VP » pour VP-014), ambre s'il est en maintenance. */
export function ItemTile({
  name,
  reference,
  maintenance = false,
  size = "md",
}: {
  name: string;
  reference?: string;
  maintenance?: boolean;
  size?: "md" | "xl";
}) {
  const prefix = reference?.split("-")[0]?.slice(0, 3);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center border-[1.5px] font-mono font-semibold",
        size === "md" ? "size-10 text-label" : "size-24 text-2xl",
        maintenance
          ? "border-warning bg-warning-bg text-warning"
          : "border-ink bg-info-bg text-ink",
      )}
    >
      {prefix || initials(name)}
    </span>
  );
}
