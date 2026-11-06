/** CSV lisible par Excel (séparateur « ; », BOM UTF-8 pour les accents). */
export function toCsv(header: string[], rows: Array<Array<string | number | null>>): string {
  const cell = (value: string | number | null) => {
    const text = value === null ? "" : String(value);
    return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return `﻿${[header, ...rows].map((row) => row.map(cell).join(";")).join("\r\n")}\r\n`;
}
