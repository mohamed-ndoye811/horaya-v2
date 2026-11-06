import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Link } from "@/lib/navigation";

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Largeur fixe en px ; sans largeur, la colonne prend la place restante. */
  width?: number;
  align?: "left" | "right" | "center";
  cell: (row: T) => ReactNode;
}

const alignment = { left: "text-left", right: "text-right", center: "text-center" } as const;

/*
 * Filtre, recherche, tri : la liste se réorganise. Une ligne qui sort se replie (hauteur → 0) en
 * s'effaçant, une ligne qui entre se déplie à sa place, les autres suivent et glissent si leur
 * ordre change (Motion). Le filet fait partie de la ligne. Au premier affichage, simple fondu
 * échelonné (reveal-group). Au-delà de 80 lignes, pas de glissement : trop de mesures.
 */
const LAYOUT_ROWS_MAX = 80;
const ease = [0.2, 0, 0, 1] as const;
const DURATION = 0.3;
/** Décalage entre deux lignes qui entrent (ou sortent), plafonné à 10 lignes. */
const STAGGER = 0.035;
const STAGGER_MAX = 10;
/**
 * Au-delà, la liste se met à jour sans pliage : chaque cellule anime sa hauteur, ce qui
 * recalcule la mise en page à chaque image (conseil Motion : réserver aux petits ensembles).
 */
const FOLD_CHANGES_MAX = 24;
/** Fin du fondu échelonné de la première arrivée (500 ms + 8 décalages de 40 ms). */
const FIRST_REVEAL_MS = 1000;

/**
 * Tableau des listes de l'admin (DA v4) : une carte blanche arrondie, en-têtes gris sur
 * bandeau clair, lignes séparées d'un filet. `table-fixed` : chaque colonne garde la même
 * largeur d'une ligne à l'autre ; défilement horizontal plutôt qu'un tableau écrasé.
 * Avec `card`, le tableau devient une liste de cartes sous `lg` (maquettes mobiles).
 */
export function DataTable<T>({
  label,
  columns,
  rows,
  rowKey,
  minWidth = 880,
  dense = false,
  flush = false,
  empty,
  card,
  group,
  rowTone,
  rowHref,
}: {
  label: string;
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  minWidth?: number;
  /** Lignes plus serrées (participants d'un événement). */
  dense?: boolean;
  /** Sans marge aux extrémités : tableau posé dans une colonne déjà espacée (paramètres). */
  flush?: boolean;
  /** Contenu affiché quand il n'y a aucune ligne. */
  empty?: ReactNode;
  /** Version mobile d'une ligne : remplace le tableau sous `lg`. */
  card?: (row: T) => ReactNode;
  /** Ancienne option (filet au-dessus des cartes), sans effet depuis la DA v4. */
  cardRule?: boolean;
  /**
   * Regroupe les lignes consécutives sous un bandeau (« Cette semaine 4 ») : renvoie le
   * libellé du groupe de chaque ligne, déjà triée.
   */
  group?: (row: T) => string;
  /** Ligne mise en avant (réservation à valider) : fond ambre pâle ; `muted` : annulée, grisée. */
  rowTone?: (row: T) => "warning" | "muted" | undefined;
  /**
   * Fiche de la ligne : un clic n'importe où sur la ligne y mène. Les liens et boutons des
   * cellules gardent leur propre action.
   */
  rowHref?: (row: T) => string;
}) {
  const edge = "px-3 first:pl-5 last:pr-5";
  const groupOf = (index: number) => {
    if (!group) return null;
    const row = rows[index] as T;
    const label = group(row);
    if (index > 0 && group(rows[index - 1] as T) === label) return null;
    let count = 0;
    for (let next = index; next < rows.length && group(rows[next] as T) === label; next++) count++;
    return { label, count };
  };
  const band = (heading: { label: string; count: number }) => (
    <>
      {heading.label}
      <span className="ml-2 font-medium text-ink-subtle">{heading.count}</span>
    </>
  );
  // Carte blanche posée à 16 px des bords, ou collée à sa colonne (`flush`).
  const shell = cn("overflow-hidden rounded-3xl bg-surface", !flush && "mx-4");
  const layout = rows.length <= LAYOUT_ROWS_MAX ? ("position" as const) : false;
  // Fondu échelonné à la première arrivée seulement : ensuite, Motion anime les entrées.
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setArrived(true), FIRST_REVEAL_MS);
    return () => clearTimeout(timer);
  }, []);
  // Lignes à plat (bandeaux de groupe compris), chacune avec sa clé : AnimatePresence suit les
  // entrées et sorties.
  const entries: Array<{ key: string; heading?: { label: string; count: number }; row?: T }> = [];
  rows.forEach((row, index) => {
    const heading = groupOf(index);
    if (heading) entries.push({ key: `groupe:${heading.label}`, heading });
    entries.push({ key: rowKey(row), row });
  });

  // Rang de chaque ligne parmi celles qui entrent (ou qui sortent), de haut en bas : le décalage
  // ne compte que les lignes qui changent.
  const keys = entries.map((entry) => entry.key);
  const previous = useRef<string[]>(keys);
  const ranks = useRef(new Map<string, number>());
  const now = new Set(keys);
  const before = new Set(previous.current);
  ranks.current = new Map([
    ...keys.filter((key) => !before.has(key)).map((key, rank) => [key, rank] as const),
    ...previous.current.filter((key) => !now.has(key)).map((key, rank) => [key, rank] as const),
  ]);
  useEffect(() => {
    previous.current = keys;
  });
  const animated = ranks.current.size <= FOLD_CHANGES_MAX;
  const timing = (key: string) =>
    animated
      ? {
          duration: DURATION,
          ease,
          delay: Math.min(ranks.current.get(key) ?? 0, STAGGER_MAX) * STAGGER,
        }
      : { duration: 0 };
  /** Ligne entière (fondu) : filet et fond compris. */
  const rowVariants = {
    hidden: (key: string) => ({ opacity: 0, transition: timing(key) }),
    shown: (key: string) => ({ opacity: 1, transition: timing(key) }),
  };
  /** Contenu d'une cellule qui se plie : coupé seulement pendant le pliage (menus « … » intacts). */
  const foldVariants = {
    hidden: (key: string) => ({ height: 0, overflow: "hidden", transition: timing(key) }),
    shown: (key: string) => ({
      height: "auto",
      transition: timing(key),
      transitionEnd: { overflow: "visible" },
    }),
  };
  const rowMotion = (key: string) =>
    ({
      layout,
      custom: key,
      variants: rowVariants,
      initial: "hidden",
      animate: "shown",
      exit: "hidden",
      transition: { layout: { duration: DURATION, ease } },
    }) as const;
  const fold = (key: string) => ({ custom: key, variants: foldVariants }) as const;

  return (
    <>
      {card && (
        <ul
          aria-label={label}
          className={cn("flex flex-col lg:hidden", !arrived && "reveal-group", shell)}
        >
          {rows.length === 0 && empty && <li>{empty}</li>}
          <AnimatePresence initial={false}>
            {entries.map((entry) =>
              entry.heading ? (
                <motion.li
                  key={entry.key}
                  {...rowMotion(entry.key)}
                  className="border-t border-line-soft bg-band first:border-t-0"
                >
                  <motion.div {...fold(entry.key)}>
                    <div className="px-4 py-2 text-xs font-bold leading-4 text-ink">
                      {band(entry.heading)}
                    </div>
                  </motion.div>
                </motion.li>
              ) : (
                <motion.li
                  key={entry.key}
                  {...rowMotion(entry.key)}
                  className={cn(
                    "relative border-t border-line-soft first:border-t-0",
                    rowTone?.(entry.row as T) === "warning" && "bg-warning-bg/50",
                    rowTone?.(entry.row as T) === "muted" && "opacity-60",
                  )}
                >
                  <motion.div {...fold(entry.key)}>
                    <div className="px-4 py-4">{card(entry.row as T)}</div>
                  </motion.div>
                </motion.li>
              ),
            )}
          </AnimatePresence>
        </ul>
      )}
      <div className={cn(shell, card ? "hidden lg:block" : undefined)}>
        <div className="overflow-x-auto">
          <table
            aria-label={label}
            // Bordures séparées : le filet de chaque ligne est porté par ses cellules, il bouge
            // avec la ligne (en bordures fusionnées, il appartiendrait au tableau).
            className="w-full table-fixed border-separate border-spacing-0"
            style={{ minWidth }}
          >
            <colgroup>
              {columns.map((column) => (
                <col key={column.key} style={column.width ? { width: column.width } : undefined} />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-band">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      "h-10 text-xs font-bold leading-4 text-ink-muted",
                      edge,
                      alignment[column.align ?? "left"],
                    )}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={cn(!arrived && "reveal-group [--reveal:var(--animate-fade)]")}>
              {rows.length === 0 && empty && (
                <tr>
                  <td colSpan={columns.length}>{empty}</td>
                </tr>
              )}
              <AnimatePresence initial={false}>
                {entries.map((entry) =>
                  entry.heading ? (
                    <motion.tr key={entry.key} {...rowMotion(entry.key)} className="bg-band">
                      <th
                        scope="rowgroup"
                        colSpan={columns.length}
                        className="border-t border-line-soft px-5 text-left text-xs font-bold leading-4 text-ink"
                      >
                        <motion.div {...fold(entry.key)}>
                          <div className="flex h-8 items-center">{band(entry.heading)}</div>
                        </motion.div>
                      </th>
                    </motion.tr>
                  ) : (
                    <motion.tr
                      key={entry.key}
                      {...rowMotion(entry.key)}
                      className={cn(
                        "transition-colors hover:bg-band",
                        rowHref && "relative cursor-pointer",
                        rowTone?.(entry.row as T) === "warning" && "bg-warning-bg/50",
                        rowTone?.(entry.row as T) === "muted" && "opacity-60",
                      )}
                    >
                      {columns.map((column, columnIndex) => (
                        <td
                          key={column.key}
                          className={cn(
                            "min-w-0 border-t border-line-soft align-middle",
                            edge,
                            alignment[column.align ?? "left"],
                          )}
                        >
                          {rowHref && columnIndex === 0 && (
                            // Lien qui couvre la ligne ; le lien principal de la cellule reste
                            // celui qu'on atteint au clavier.
                            <Link
                              href={rowHref(entry.row as T)}
                              tabIndex={-1}
                              aria-hidden="true"
                              className="absolute inset-0"
                            />
                          )}
                          <motion.div {...fold(entry.key)}>
                            <div
                              className={cn(
                                "flex min-w-0 items-center",
                                dense ? "py-2" : "py-2.5",
                                rowHref &&
                                  "pointer-events-none relative [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_input]:pointer-events-auto",
                                column.align === "right" && "justify-end",
                                column.align === "center" && "justify-center",
                              )}
                            >
                              {column.cell(entry.row as T)}
                            </div>
                          </motion.div>
                        </td>
                      ))}
                    </motion.tr>
                  ),
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
