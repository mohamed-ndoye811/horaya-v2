import { getPublicWorkspace } from "@horaya/db";
import { cache } from "react";
import { type PaymentChannel, paymentChannel } from "@/lib/payment-channel";
import { db } from "./db";
import { integratedPaymentsEnabled } from "./payments/config";

/** Espace d'une page publique, lu une fois par rendu (mise en page + page). */
export const getWorkspaceBySlug = cache((slug: string) => getPublicWorkspace(db, slug));

/** Moyen de paiement en ligne d'un espace pour un événement (Stripe intégré, lien, ou rien). */
export function workspacePaymentChannel(
  workspace: { onlinePayments: boolean; paymentLinkUrl: string | null },
  paymentMode: string,
  eventLink: string | null,
): PaymentChannel {
  return paymentChannel({
    paymentMode,
    stripeReady: integratedPaymentsEnabled && workspace.onlinePayments,
    eventLink,
    workspaceLink: workspace.paymentLinkUrl,
  });
}
