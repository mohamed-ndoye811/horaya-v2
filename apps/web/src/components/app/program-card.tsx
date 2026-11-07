import type { ReactNode } from "react";
import { Link } from "@/lib/navigation";

/**
 * Carte de programme (DA v4, « Aujourd'hui » du tableau de bord) : bandeau avec un titre et un
 * compte, puis des lignes `ProgramRow`. Sans ligne, `empty` s'affiche à leur place.
 */
export function ProgramCard({
  title,
  count,
  empty,
  children,
}: {
  title: ReactNode;
  count?: string;
  empty?: string;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col overflow-hidden rounded-[22px] bg-surface">
      <h2 className="flex h-11 items-center justify-between gap-3 bg-band px-4">
        <span className="text-[13px] font-bold leading-4 text-ink">{title}</span>
        {count && <span className="shrink-0 text-xs leading-4 text-ink-subtle">{count}</span>}
      </h2>
      {empty ? (
        <p className="border-t border-line-faint px-4 py-4 text-sm leading-[18px] text-ink-subtle">
          {empty}
        </p>
      ) : (
        children
      )}
    </section>
  );
}

/** Ligne de programme : heure, barre de la couleur du type, titre et détail, et un ajout à droite. */
export function ProgramRow({
  href,
  time,
  color,
  title,
  detail,
  trailing,
}: {
  href?: string;
  time: string;
  color: string;
  title: string;
  detail?: string;
  trailing?: ReactNode;
}) {
  const className = "flex min-h-[62px] items-center gap-3 border-t border-line-faint px-4 py-2.5";
  const content = (
    <>
      <span className="w-11 shrink-0 font-mono text-xs font-semibold leading-4 text-ink">
        {time}
      </span>
      <span
        aria-hidden="true"
        className="h-8 w-[3px] shrink-0 rounded-[2px]"
        style={{ backgroundColor: color }}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold leading-5 text-ink">{title}</span>
        {detail && <span className="truncate text-xs leading-4 text-ink-subtle">{detail}</span>}
      </span>
      {trailing}
    </>
  );
  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
