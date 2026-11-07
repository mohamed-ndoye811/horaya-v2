import { afterEach, describe, expect, it, vi } from "vitest";
import { currentToast, dismissToast, holdToast, toast } from "./toast";

describe("languette : file des messages", () => {
  afterEach(() => {
    while (currentToast()) dismissToast(currentToast()?.id ?? 0);
    vi.useRealTimers();
  });

  it("un message à la fois, retiré après 4,5 s ; le survol le garde", () => {
    vi.useFakeTimers();
    toast("Un");
    toast("Deux", { tone: "error" });
    expect(currentToast()).toMatchObject({ message: "Un", tone: "success" });

    holdToast(true);
    vi.advanceTimersByTime(10_000);
    expect(currentToast()?.message).toBe("Un");
    holdToast(false);
    vi.advanceTimersByTime(2000);
    expect(currentToast()).toMatchObject({ message: "Deux", tone: "error" });

    vi.advanceTimersByTime(4500);
    expect(currentToast()).toBeNull();
  });

  it("garde le message affiché et oublie les plus anciens en attente", () => {
    vi.useFakeTimers();
    for (const n of [1, 2, 3, 4, 5, 6]) toast(`Message ${n}`);
    const seen: string[] = [];
    while (currentToast()) {
      seen.push(currentToast()?.message ?? "");
      vi.advanceTimersByTime(4500);
    }
    expect(seen).toEqual(["Message 1", "Message 4", "Message 5", "Message 6"]);
  });
});
