import type { CreateItemInput } from "./schemas";

/** Colonnes du fichier d'import du matériel (écran 20, « Importer CSV »), dans l'ordre du modèle. */
export const ITEM_CSV_COLUMNS = [
  { field: "name", header: "Nom", example: "Vidéoprojecteur Epson 4K" },
  { field: "reference", header: "Référence", example: "VP-014" },
  { field: "typeName", header: "Catégorie", example: "Vidéo" },
  { field: "quantity", header: "Quantité", example: "3" },
  { field: "dailyRate", header: "Tarif par jour", example: "45" },
  { field: "deposit", header: "Caution", example: "300" },
  { field: "rentable", header: "Location", example: "oui" },
  { field: "storageLocation", header: "Emplacement", example: "Réserve A" },
  { field: "description", header: "Description", example: "Câble HDMI fourni" },
] as const;
type ColumnField = (typeof ITEM_CSV_COLUMNS)[number]["field"];

/** Intitulé de colonne d'un champ de l'article, pour situer une erreur. */
export const ITEM_CSV_HEADERS: Record<string, string> = {
  name: "Nom",
  reference: "Référence",
  typeName: "Catégorie",
  quantity: "Quantité",
  dailyRateCents: "Tarif par jour",
  depositCents: "Caution",
  rentable: "Location",
  storageLocation: "Emplacement",
  description: "Description",
};

/** Un import se fait en une fois : au-delà, mieux vaut découper le fichier. */
export const MAX_IMPORTED_ITEMS = 500;

export interface ParsedItemRow {
  /** Numéro de ligne dans le fichier (l'en-tête est la ligne 1). */
  line: number;
  input: CreateItemInput;
}

/** Lignes lues et erreurs de lecture (toutes, pour tout corriger d'un coup). */
export interface ItemsCsvResult {
  rows: ParsedItemRow[];
  errors: string[];
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\(.*?\)|€/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Autres intitulés acceptés pour chaque colonne (normalisés). */
const HEADER_ALIASES: Record<ColumnField, string[]> = {
  name: ["nom", "article", "nom de l article"],
  reference: ["reference", "ref"],
  typeName: ["categorie", "type"],
  quantity: ["quantite", "qte", "exemplaires", "nombre"],
  dailyRate: ["tarif par jour", "tarif", "prix par jour", "prix jour", "par jour"],
  deposit: ["caution", "depot de garantie"],
  rentable: ["location", "a louer", "louable", "propose a la location"],
  storageLocation: ["emplacement", "rangement", "lieu de stockage"],
  description: ["description", "notes", "remarques"],
};

/** Découpe un CSV (guillemets « "" » compris) ; le séparateur est deviné sur l'en-tête. */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const separator = [";", ",", "\t"].reduce((best, candidate) =>
    firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best,
  );

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell === "") {
      quoted = true;
    } else if (char === separator) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** « 45 », « 45,50 », « 1 200,00 € » → centimes ; NaN si illisible, null si vide. */
function parseEuros(value: string): number | null {
  const cleaned = value.replace(/[\s  €]/g, "").replace(",", ".");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  return Math.round(Number(cleaned) * 100);
}

function parseYesNo(value: string): boolean | null {
  const normalized = normalize(value);
  if (normalized === "") return null;
  if (["oui", "o", "yes", "y", "x", "1", "vrai", "true"].includes(normalized)) return true;
  if (["non", "n", "no", "0", "faux", "false"].includes(normalized)) return false;
  return null;
}

/**
 * Lit le fichier d'import du matériel. Les colonnes sont reconnues par leur intitulé
 * (accents et majuscules ignorés), dans n'importe quel ordre ; « Nom » est obligatoire.
 * Les valeurs sont validées ensuite par le cas d'usage, ligne par ligne.
 */
export function parseItemsCsv(text: string): ItemsCsvResult {
  const [header, ...lines] = parseCsv(text);
  if (!header) return { rows: [], errors: ["Le fichier est vide."] };

  const columns = new Map<ColumnField, number>();
  header.forEach((title, index) => {
    const normalized = normalize(title);
    const column = ITEM_CSV_COLUMNS.find(
      (entry) =>
        normalize(entry.header) === normalized || HEADER_ALIASES[entry.field].includes(normalized),
    );
    if (column && !columns.has(column.field)) columns.set(column.field, index);
  });
  if (!columns.has("name")) {
    return {
      rows: [],
      errors: ["Colonne « Nom » introuvable : la première ligne doit contenir les intitulés."],
    };
  }

  const rows: ParsedItemRow[] = [];
  const errors: string[] = [];
  lines.forEach((cells, offset) => {
    if (cells.every((cell) => cell.trim() === "")) return;
    const line = offset + 2;
    const cell = (field: ColumnField) => {
      const index = columns.get(field);
      return index === undefined ? "" : (cells[index] ?? "").trim();
    };
    const quantity = cell("quantity");
    const rentable = cell("rentable");
    const rentableValue = parseYesNo(rentable);
    if (rentable !== "" && rentableValue === null) {
      errors.push(`Ligne ${line} (Location) : oui ou non attendu`);
      return;
    }
    rows.push({
      line,
      input: {
        name: cell("name"),
        reference: cell("reference"),
        typeName: cell("typeName") || null,
        quantity: quantity === "" ? 1 : Number(quantity.replace(/\s/g, "")),
        dailyRateCents: parseEuros(cell("dailyRate")),
        depositCents: parseEuros(cell("deposit")),
        rentable: rentableValue ?? false,
        storageLocation: cell("storageLocation") || null,
        description: cell("description") || null,
      },
    });
  });

  if (rows.length === 0 && errors.length === 0) errors.push("Aucun article dans le fichier.");
  if (rows.length > MAX_IMPORTED_ITEMS) {
    return {
      rows: [],
      errors: [`${MAX_IMPORTED_ITEMS} articles maximum par import : découpe le fichier.`],
    };
  }
  return { rows, errors };
}
