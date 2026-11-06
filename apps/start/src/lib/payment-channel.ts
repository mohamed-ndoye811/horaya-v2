/**
 * Comment le client paie en ligne : Stripe intégré (compte de l'organisateur connecté), lien de
 * paiement externe (celui de l'événement, sinon celui de l'espace), ou rien (sur place / auprès
 * de l'organisateur).
 */
export type PaymentChannel = { kind: "stripe" } | { kind: "link"; url: string } | null;

export function paymentChannel(input: {
  paymentMode: string;
  stripeReady: boolean;
  eventLink: string | null;
  workspaceLink: string | null;
}): PaymentChannel {
  if (input.paymentMode !== "online" && input.paymentMode !== "deposit") return null;
  if (input.stripeReady) return { kind: "stripe" };
  const url = input.eventLink ?? input.workspaceLink;
  return url ? { kind: "link", url } : null;
}
