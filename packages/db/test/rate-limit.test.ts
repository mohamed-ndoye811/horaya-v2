import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { consumeRateLimit } from "../src/rate-limit";
import { db } from "./helpers";

afterAll(() => db.$client.end());

describe("consumeRateLimit", () => {
  it("laisse passer jusqu'à la limite, puis rouvre la fenêtre suivante", async () => {
    const key = `test:${randomUUID()}`;
    const t0 = new Date("2026-10-07T10:00:00Z");
    for (let i = 0; i < 3; i++)
      expect((await consumeRateLimit(db, key, 3, 60, t0)).allowed).toBe(true);
    const blocked = await consumeRateLimit(db, key, 3, 60, new Date("2026-10-07T10:00:20Z"));
    expect(blocked).toEqual({ allowed: false, retryAfterSeconds: 40 });
    expect((await consumeRateLimit(db, key, 3, 60, new Date("2026-10-07T10:01:00Z"))).allowed).toBe(
      true,
    );
  });

  it("reste juste sous des essais simultanés", async () => {
    const key = `test:${randomUUID()}`;
    const now = new Date("2026-10-07T10:00:00Z");
    const results = await Promise.all(
      Array.from({ length: 10 }, () => consumeRateLimit(db, key, 4, 60, now)),
    );
    expect(results.filter((result) => result.allowed)).toHaveLength(4);
  });
});
