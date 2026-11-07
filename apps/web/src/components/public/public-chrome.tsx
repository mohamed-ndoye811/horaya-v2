import type { CSSProperties } from "react";
import { luminance, textOn } from "@/lib/colors";
import { Link } from "@/lib/navigation";

/**
 * Marque blanche (maquettes 5.1 à 5.6) : la page publique prend les couleurs de l'espace.
 * La teinte sombre de la marque remplace le noir (notch, texte, cartes sombres), une teinte
 * très claire sert de fond, et la couleur elle-même porte les actions. Les jetons de la DA
 * sont redéfinis ici : tous les composants suivent sans variante.
 */
export function brandStyle(color: string): CSSProperties {
  const ink = `color-mix(in srgb, ${color} 16%, #111111)`;
  const bg = `color-mix(in srgb, ${color} 5%, #f6f6f4)`;
  return {
    "--brand": color,
    "--on-brand": textOn(color),
    // Texte de la couleur de marque sur fond blanc : assombri si la couleur est trop claire.
    "--brand-text": luminance(color) < 0.3 ? color : `color-mix(in srgb, ${color} 55%, #111111)`,
    // Teinte claire de la marque sur fond sombre (sur-titre du bandeau).
    "--brand-light": `color-mix(in srgb, ${color} 30%, white)`,
    "--color-ink": ink,
    "--color-bg": bg,
    "--color-field": `color-mix(in srgb, ${bg} 50%, white)`,
    "--color-band": `color-mix(in srgb, ${bg} 50%, white)`,
    "--color-ink-muted": `color-mix(in srgb, ${ink} 62%, ${bg})`,
    "--color-ink-subtle": `color-mix(in srgb, ${ink} 45%, ${bg})`,
    "--color-line": `color-mix(in srgb, ${ink} 8%, ${bg})`,
    "--color-line-soft": `color-mix(in srgb, ${color} 6%, ${bg})`,
    "--color-notch-idle": `color-mix(in srgb, ${color} 20%, #c4bfbb)`,
  } as CSSProperties;
}

/** Logo de l'espace, sinon pastille carrée arrondie à son initiale (notch, en-tête mobile). */
export function WorkspaceMark({ name, logo }: { name: string; logo?: string | null }) {
  if (logo) {
    return <img src={logo} alt="" className="size-7 shrink-0 rounded-lg object-cover" />;
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)] text-sm font-bold text-[var(--on-brand)]"
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

/** Lien de contact de l'espace : e-mail, sinon téléphone. */
export function contactHref(workspace: {
  contactEmail: string | null;
  contactPhone: string | null;
}): string | null {
  if (workspace.contactEmail) return `mailto:${workspace.contactEmail}`;
  if (workspace.contactPhone) return `tel:${workspace.contactPhone.replace(/[^+\d]/g, "")}`;
  return null;
}

/** Pied des pages publiques : coordonnées, mentions légales, « propulsées par Horaya ». */
export function PublicFooter({
  workspace,
}: {
  workspace: {
    name: string;
    slug: string;
    address: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
  };
}) {
  const details = [
    workspace.name,
    workspace.address?.split("\n").join(", "),
    workspace.contactEmail ?? workspace.contactPhone,
  ].filter(Boolean);
  return (
    <footer className="flex flex-col gap-2 px-5 pt-2 pb-5 text-[13px] leading-4 text-ink-subtle sm:flex-row sm:items-center sm:justify-between">
      <p>
        {details.join(" · ")} ·{" "}
        <Link
          href={`/${workspace.slug}/mentions-legales`}
          className="tap-area underline underline-offset-2 hover:text-ink"
        >
          Mentions légales
        </Link>
      </p>
      <Link href="/" className="tap-area w-fit text-xs font-semibold hover:text-ink">
        Réservations propulsées par Horaya
      </Link>
    </footer>
  );
}
