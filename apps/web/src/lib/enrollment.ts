import type { Tone } from "@/components/ui/badge";
import { paymentChannel } from "./payment-channel";

/**
 * Paiement d'une inscription à une série : un seul montant, réglé par le lien de paiement
 * externe (celui de la première séance, sinon celui de l'espace), sur place, ou auprès de
 * l'atelier. Le paiement intégré (Stripe) ne couvre pas encore les inscriptions.
 */
export function enrollmentPayment(
  enrollment: {
    amountCents: number;
    paidAt: Date | null;
    sessions: ReadonlyArray<{ paymentMode: string; paymentLinkUrl: string | null }>;
  },
  workspaceLink: string | null,
): { label: string; tone: Tone; payUrl: string | null } | null {
  if (enrollment.amountCents === 0) return null;
  if (enrollment.paidAt) return { label: "Payé", tone: "success", payUrl: null };
  const first = enrollment.sessions[0];
  const channel = first
    ? paymentChannel({
        paymentMode: first.paymentMode,
        stripeReady: false,
        eventLink: first.paymentLinkUrl,
        workspaceLink,
      })
    : null;
  if (channel?.kind === "link") {
    return { label: "À payer en ligne", tone: "warning", payUrl: channel.url };
  }
  return {
    label: first?.paymentMode === "on_site" ? "À régler sur place" : "À régler auprès de l'atelier",
    tone: "draft",
    payUrl: null,
  };
}
