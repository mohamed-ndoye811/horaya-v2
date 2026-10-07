import { cn } from "@/lib/cn";
import { colorFor, textOn } from "@/lib/colors";
import { initials } from "@/lib/format";

const sizes = {
  sm: "size-8 text-label",
  md: "size-9 text-sm",
  lg: "size-10 text-sm",
};

/** Avatar carré à initiales ; la couleur est stable pour un même nom. */
export function Avatar({
  name,
  color,
  size = "lg",
  pending = false,
}: {
  name: string;
  /** Couleur imposée (sinon dérivée du nom). */
  color?: string;
  size?: keyof typeof sizes;
  /** Invitation en attente : cadre pointillé, pas de fond. */
  pending?: boolean;
}) {
  const background = color ?? colorFor(name);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center font-bold leading-4",
        sizes[size],
        pending && "border-[1.5px] border-dashed border-ink-subtle bg-draft-bg text-ink-muted",
      )}
      style={pending ? undefined : { backgroundColor: background, color: textOn(background) }}
    >
      {initials(name)}
    </span>
  );
}

/** Carré de couleur d'une catégorie (type d'événement). */
export function CategorySwatch({ color, size = 10 }: { color: string; size?: 10 | 12 | 14 }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0"
      style={{ backgroundColor: color, width: size, height: size }}
    />
  );
}
