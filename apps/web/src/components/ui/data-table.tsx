import { animate } from "motion/react";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
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
 * Filtre, recherche, tri : la nouvelle liste apparaît d'un bloc, en fondu (une seule animation
 * d'opacité, quel que soit le nombre de lignes). Au premier affichage, fondu échelonné des
 * lignes (reveal-group).
 */
const SWAP = { duration: 0.2, ease: [0.2, 0, 0, 1] } as const;
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
  // Fondu échelonné à la première arrivée seulement : ensuite, la liste change d'un bloc.
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setArrived(true), FIRST_REVEAL_MS);
    return () => clearTimeout(timer);
  }, []);
  // Lignes à plat (bandeaux de groupe compris), chacune avec sa clé.
  const entries: Array<{ key: string; heading?: { label: string; count: number }; row?: T }> = [];
  rows.forEach((row, index) => {
    const heading = groupOf(index);
    if (heading) entries.push({ key: `groupe:${heading.label}`, heading });
    entries.push({ key: rowKey(row), row });
  });

  // La liste a changé : fondu posé avant la première image, pour ne jamais la voir surgir.
  const signature = entries.map((entry) => entry.key).join("\n");
  const shown = useRef(signature);
  const listRef = useRef<HTMLUListElement>(null);
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  useLayoutEffect(() => {
    if (shown.current === signature) return;
    shown.current = signature;
    for (const node of [listRef.current, bodyRef.current]) {
      if (!node) continue;
      // Posé tout de suite : Motion ne démarre qu'à l'image suivante.
      node.style.opacity = "0";
      animate(node, { opacity: [0, 1] }, SWAP);
    }
  }, [signature]);
  const reveal = !arrived && "reveal-group";

  return (
    <>
      {card && (
        <ul
          ref={listRef}
          aria-label={label}
          className={cn("flex flex-col lg:hidden", reveal, shell)}
        >
          {rows.length === 0 && empty && <li>{empty}</li>}
          {entries.map((entry) =>
            entry.heading ? (
              <li
                key={entry.key}
                className="border-t border-line-soft bg-band px-4 py-2 text-xs font-bold leading-4 text-ink first:border-t-0"
              >
                {band(entry.heading)}
              </li>
            ) : (
              <li
                key={entry.key}
                className={cn(
                  "relative border-t border-line-soft px-4 py-4 first:border-t-0",
                  rowTone?.(entry.row as T) === "warning" && "bg-warning-bg/50",
                  rowTone?.(entry.row as T) === "muted" && "opacity-60",
                )}
              >
                {card(entry.row as T)}
              </li>
            ),
          )}
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
            <tbody ref={bodyRef} className={cn(reveal, "[--reveal:var(--animate-fade)]")}>
              {rows.length === 0 && empty && (
                <tr>
                  <td colSpan={columns.length}>{empty}</td>
                </tr>
              )}
              {entries.map((entry) =>
                entry.heading ? (
                  <tr key={entry.key} className="bg-band">
                    <th
                      scope="rowgroup"
                      colSpan={columns.length}
                      className="h-8 border-t border-line-soft px-5 text-left text-xs font-bold leading-4 text-ink"
                    >
                      {band(entry.heading)}
                    </th>
                  </tr>
                ) : (
                  <tr
                    key={entry.key}
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
                      </td>
                    ))}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
