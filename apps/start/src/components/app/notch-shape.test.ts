import { describe, expect, it } from "vitest";
import { notchShape } from "./notch-shape";

describe("notchShape", () => {
  it("replié : la courbe en S de la maquette (C24 6 20 56 44 56), coupée en deux moitiés", () => {
    const { d } = notchShape(600, 56, 0);
    expect(d).toBe(
      "M0 0 L0 6 C12 6 17 18.5 22 31 L22 31 C27 43.5 32 56 44 56 L556 56 C568 56 573 43.5 578 31 L578 31 C583 18.5 588 6 600 6 L600 0 Z",
    );
  });

  it("agrandi : raccord de 28 px à la verticale, flanc droit, coin de 28 px", () => {
    const { d, side, radius } = notchShape(680, 400, 1);
    expect(side).toBe(28);
    expect(radius).toBe(28);
    expect(d).toContain("C22 6 28 14 28 36 L28 372 C28 387.46 40.54 400 56 400 L624 400");
  });

  it("le flanc ne remonte jamais au-dessus du raccord", () => {
    expect(notchShape(700, 40, 0.5).d).not.toContain("NaN");
  });
});
