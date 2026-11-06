import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

/** Vignette d'un article (DA v4) : préfixe de sa référence (« VP » pour VP-014) sur fond gris, ambre en maintenance. */
export function ItemTile({
  name,
  reference,
  maintenance = false,
  size = "md",
  photoUrl,
}: {
  name: string;
  reference?: string;
  maintenance?: boolean;
  size?: "md" | "xl";
  photoUrl?: string | null;
}) {
  const prefix = reference?.split("-")[0]?.slice(0, 3);
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        className={cn(
          "shrink-0 object-cover",
          size === "md" ? "size-11 rounded-xl" : "size-24 rounded-2xl",
        )}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center font-bold",
        size === "md" ? "size-11 rounded-xl text-xs" : "size-24 rounded-2xl text-2xl",
        maintenance ? "bg-warning-bg text-warning" : "bg-field text-ink-subtle",
      )}
    >
      {prefix || initials(name)}
    </span>
  );
}
