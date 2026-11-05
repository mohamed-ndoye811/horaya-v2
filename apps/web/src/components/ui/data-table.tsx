import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Largeur fixe en px ; sans largeur, la colonne prend la place restante. */
  width?: number;
  align?: "left" | "right" | "center";
  cell: (row: T) => ReactNode;
}

const alignment = { left: "text-left", right: "text-right", center: "text-center" } as const;

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
  return (
    <>
      {card && (
        <ul aria-label={label} className={cn("reveal-group flex flex-col lg:hidden", shell)}>
          {rows.length === 0 && empty && <li>{empty}</li>}
          {rows.map((row, index) => {
            const heading = groupOf(index);
            return (
              <Fragment key={rowKey(row)}>
                {heading && (
                  <li className="border-t border-line-soft bg-band px-4 py-2 text-xs font-bold leading-4 text-ink first:border-t-0">
                    {band(heading)}
                  </li>
                )}
                <li
                  className={cn(
                    "relative border-t border-line-soft px-4 py-4 first:border-t-0",
                    rowTone?.(row) === "warning" && "bg-warning-bg/50",
                    rowTone?.(row) === "muted" && "opacity-60",
                  )}
                >
                  {card(row)}
                </li>
              </Fragment>
            );
          })}
        </ul>
      )}
      <div className={cn(shell, card ? "hidden lg:block" : undefined)}>
        <div className="overflow-x-auto">
          <table
            aria-label={label}
            className="w-full table-fixed border-collapse"
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
            {/* Les lignes arrivent l'une après l'autre au premier affichage. */}
            <tbody className="reveal-group">
              {rows.length === 0 && empty && (
                <tr>
                  <td colSpan={columns.length}>{empty}</td>
                </tr>
              )}
              {rows.map((row, index) => {
                const heading = groupOf(index);
                return (
                  <Fragment key={rowKey(row)}>
                    {heading && (
                      <tr className="border-t border-line-soft bg-band">
                        <th
                          scope="rowgroup"
                          colSpan={columns.length}
                          className="h-8 px-5 text-left text-xs font-bold leading-4 text-ink"
                        >
                          {band(heading)}
                        </th>
                      </tr>
                    )}
                    <tr
                      className={cn(
                        "border-t border-line-soft transition-colors hover:bg-band",
                        rowHref && "relative cursor-pointer",
                        rowTone?.(row) === "warning" && "bg-warning-bg/50",
                        rowTone?.(row) === "muted" && "opacity-60",
                      )}
                    >
                      {columns.map((column, columnIndex) => (
                        <td
                          key={column.key}
                          className={cn(
                            "min-w-0 align-middle",
                            dense ? "py-2" : "py-2.5",
                            edge,
                            alignment[column.align ?? "left"],
                          )}
                        >
                          {rowHref && columnIndex === 0 && (
                            // Lien qui couvre la ligne ; le lien principal de la cellule reste
                            // celui qu'on atteint au clavier.
                            <Link
                              href={rowHref(row)}
                              tabIndex={-1}
                              aria-hidden="true"
                              className="absolute inset-0"
                            />
                          )}
                          <div
                            className={cn(
                              "flex min-w-0 items-center",
                              rowHref &&
                                "pointer-events-none relative [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_input]:pointer-events-auto",
                              column.align === "right" && "justify-end",
                              column.align === "center" && "justify-center",
                            )}
                          >
                            {column.cell(row)}
                          </div>
                        </td>
                      ))}
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
