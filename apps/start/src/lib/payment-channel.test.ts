import { describe, expect, it } from "vitest";
import { paymentChannel } from "./payment-channel";

describe("paymentChannel", () => {
  const base = { paymentMode: "online", stripeReady: false, eventLink: null, workspaceLink: null };
  it("préfère Stripe connecté, puis le lien de l'événement, puis celui de l'espace", () => {
    expect(paymentChannel({ ...base, stripeReady: true, eventLink: "https://a.test" })).toEqual({
      kind: "stripe",
    });
    expect(
      paymentChannel({
        ...base,
        eventLink: "https://evenement.test",
        workspaceLink: "https://espace.test",
      }),
    ).toEqual({
      kind: "link",
      url: "https://evenement.test",
    });
    expect(paymentChannel({ ...base, workspaceLink: "https://espace.test" })).toEqual({
      kind: "link",
      url: "https://espace.test",
    });
  });
  it("ne propose rien sans lien, ni pour un paiement sur place", () => {
    expect(paymentChannel(base)).toBeNull();
    expect(
      paymentChannel({ ...base, paymentMode: "on_site", workspaceLink: "https://espace.test" }),
    ).toBeNull();
  });
});
