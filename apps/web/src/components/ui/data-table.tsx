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
}) {
  const edge = "px-3 first:pl-5 last:pr-5";
  // Carte blanche posée à 16 px des bords, ou collée à sa colonne (`flush`).
  const shell = cn("overflow-hidden rounded-3xl bg-surface", !flush && "mx-4");
  return (
    <>
      {card && (
        <ul aria-label={label} className={cn("reveal-group flex flex-col lg:hidden", shell)}>
          {rows.length === 0 && empty && <li>{empty}</li>}
          {rows.map((row) => (
            <li
              key={rowKey(row)}
              className="relative border-t border-line-soft px-4 py-4 first:border-t-0"
            >
              {card(row)}
            </li>
          ))}
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
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="border-t border-line-soft transition-colors hover:bg-band"
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "min-w-0 align-middle",
                        dense ? "py-2.5" : "py-3",
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
      </div>
    </>
  );
}
