import { describe, expect, it } from "vitest";
import { parseCsv, parseItemsCsv } from "./csv-import";

describe("parseCsv", () => {
  it("devine le séparateur et gère les guillemets", () => {
    expect(parseCsv('Nom;Description\r\n"Micro; HF";"Dit ""le gros"""\r\n')).toEqual([
      ["Nom", "Description"],
      ["Micro; HF", 'Dit "le gros"'],
    ]);
    expect(parseCsv("Nom,Quantité\nTable,4")).toEqual([
      ["Nom", "Quantité"],
      ["Table", "4"],
    ]);
  });

  it("ignore le BOM d'Excel", () => {
    expect(parseCsv("﻿Nom\nTable")[0]).toEqual(["Nom"]);
  });
});

describe("parseItemsCsv", () => {
  it("reconnaît les colonnes par leur intitulé, dans n'importe quel ordre", () => {
    const result = parseItemsCsv(
      "Quantité;NOM;Tarif par jour (€);Location;categorie\n3;Vidéoprojecteur;45,50;oui;Vidéo\n\n;Table pliante;;;\n",
    );
    expect(result).toEqual({
      errors: [],
      rows: [
        {
          line: 2,
          input: expect.objectContaining({
            name: "Vidéoprojecteur",
            quantity: 3,
            dailyRateCents: 4550,
            rentable: true,
            typeName: "Vidéo",
          }),
        },
        {
          line: 4,
          input: expect.objectContaining({
            name: "Table pliante",
            quantity: 1,
            dailyRateCents: null,
            rentable: false,
          }),
        },
      ],
    });
  });

  it("exige la colonne « Nom »", () => {
    expect(parseItemsCsv("Article X;3\n")).toMatchObject({
      rows: [],
      errors: [expect.any(String)],
    });
  });

  it("signale une valeur « Location » illisible avec sa ligne", () => {
    expect(parseItemsCsv("Nom;Location\nMicro;peut-être\nTable;non\n")).toEqual({
      rows: [expect.objectContaining({ line: 3 })],
      errors: ["Ligne 2 (Location) : oui ou non attendu"],
    });
  });

  it("rend un montant illisible invalide plutôt que de le deviner", () => {
    const result = parseItemsCsv("Nom;Caution\nMicro;trois cents\n");
    expect(result.rows[0]?.input.depositCents).toBeNaN();
  });
});
