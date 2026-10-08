import type { ReactNode } from "react";
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
 * Tableau des listes de l'admin : en-têtes mono soulignés d'encre, lignes séparées
 * d'un filet clair. `table-fixed` : chaque colonne garde la même largeur d'une ligne
 * à l'autre ; défilement horizontal sur petit écran plutôt qu'un tableau écrasé.
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
  cardRule = true,
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
  /** Filet encre au-dessus des cartes (sous une barre de filtres) ; sans, juste sous l'en-tête. */
  cardRule?: boolean;
}) {
  const edge = flush
    ? "px-2.5 first:pl-0 last:pr-0"
    : "px-3 first:pl-4 last:pr-4 sm:first:pl-10 sm:last:pr-10";
  return (
    <>
      {card && (
        <ul
          aria-label={label}
          className={cn("flex flex-col lg:hidden", cardRule && !flush && "border-t-2 border-ink")}
        >
          {rows.length === 0 && empty && <li>{empty}</li>}
          {rows.map((row) => (
            <li
              key={rowKey(row)}
              className={cn("relative border-b border-line-soft py-4", !flush && "px-4 sm:px-10")}
            >
              {card(row)}
            </li>
          ))}
        </ul>
      )}
      <div className={card ? "hidden overflow-x-auto lg:block" : "overflow-x-auto"}>
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
            <tr className="border-b-2 border-ink">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "pb-3 font-mono text-label font-semibold uppercase leading-4 tracking-[0.055em] text-ink",
                    edge,
                    alignment[column.align ?? "left"],
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && empty && (
              <tr>
                <td colSpan={columns.length}>{empty}</td>
              </tr>
            )}
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className="border-b border-line-soft transition-colors hover:bg-surface/60"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "min-w-0 align-middle",
                      dense ? "py-3" : "py-3.5",
                      edge,
                      alignment[column.align ?? "left"],
                    )}
                  >
                    <div
                      className={cn(
                        "flex min-w-0 items-center",
                        column.align === "right" && "justify-end",
                        column.align === "center" && "justify-center",
                      )}
                    >
                      {column.cell(row)}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
