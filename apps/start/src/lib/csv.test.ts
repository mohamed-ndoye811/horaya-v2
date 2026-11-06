import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("protège les cellules qui contiennent un séparateur ou des guillemets", () => {
    expect(
      toCsv(
        ["Nom", "Note"],
        [
          ["Léa", 'Dit "bonjour"; merci'],
          ["Marc", null],
        ],
      ),
    ).toBe('﻿Nom;Note\r\nLéa;"Dit ""bonjour""; merci"\r\nMarc;\r\n');
  });
});
