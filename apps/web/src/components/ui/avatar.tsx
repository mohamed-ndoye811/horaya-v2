import { cn } from "@/lib/cn";
import { colorFor, textOn } from "@/lib/colors";
import { initials } from "@/lib/format";

const sizes = {
  /** Pastille d'une ligne de réglage (intervenants d'un module). */
  mini: "size-6 text-[9px]",
  /** Participants d'une réservation. */
  xs: "size-[30px] text-[11px]",
  /** Lignes de liste (DA v4). */
  row: "size-[34px] text-xs",
  sm: "size-8 text-label",
  md: "size-9 text-sm",
  lg: "size-10 text-sm",
  /** Carte client d'une réservation. */
  profile: "size-[52px] text-[17px]",
  /** En-tête de fiche client (DA v4). */
  header: "size-[72px] text-2xl",
  /** En-tête de fiche client (96 px). */
  xl: "size-24 font-headline text-[40px]",
};

/** Avatar rond à initiales ; la couleur est stable pour un même nom. */
export function Avatar({
  name,
  color,
  size = "lg",
  pending = false,
  image,
}: {
  name: string;
  /** Photo de la personne ; sinon ses initiales. */
  image?: string | null;
  /** Couleur imposée (sinon dérivée du nom). */
  color?: string;
  size?: keyof typeof sizes;
  /** Invitation en attente : cadre pointillé, pas de fond. */
  pending?: boolean;
}) {
  const background = color ?? colorFor(name);
  if (image) {
    return (
      <img src={image} alt="" className={cn("shrink-0 rounded-full object-cover", sizes[size])} />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold leading-4",
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
      className="inline-block shrink-0 rounded-[3px]"
      style={{ backgroundColor: color, width: size, height: size }}
    />
  );
}
