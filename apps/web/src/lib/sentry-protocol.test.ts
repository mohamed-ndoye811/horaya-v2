import { describe, expect, it } from "vitest";
import { framesOf, parseDsn } from "./sentry-protocol";

describe("suivi des erreurs", () => {
  it("lit un DSN GlitchTip", () => {
    expect(parseDsn("https://abc123@glitchtip.diamondy.dev/4")).toEqual({
      key: "abc123",
      endpoint: "https://glitchtip.diamondy.dev/api/4/store/",
    });
    expect(parseDsn("pas un dsn")).toBeNull();
    expect(parseDsn(undefined)).toBeNull();
  });

  it("transforme une pile V8 en cadres, du plus ancien au plus récent", () => {
    const stack = [
      "Error: boum",
      "    at saveCustomer (/app/server/clients.ts:42:11)",
      "    at async handler (/app/node_modules/x/index.js:7:3)",
      "    at /app/server.ts:10:5",
    ].join("\n");
    expect(framesOf(stack)).toEqual([
      { function: "?", filename: "/app/server.ts", lineno: 10, colno: 5, in_app: true },
      {
        function: "async handler",
        filename: "/app/node_modules/x/index.js",
        lineno: 7,
        colno: 3,
        in_app: false,
      },
      {
        function: "saveCustomer",
        filename: "/app/server/clients.ts",
        lineno: 42,
        colno: 11,
        in_app: true,
      },
    ]);
  });
});
