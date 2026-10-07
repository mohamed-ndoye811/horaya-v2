import { getPublicCalendarLink, getPublicWorkspace } from "@horaya/db";
import { cache } from "react";
import { type PaymentChannel, paymentChannel } from "@/lib/payment-channel";
import { db } from "./db";
import { integratedPaymentsEnabled } from "./payments/config";

/** Espace d'une page publique, lu une fois par rendu (mise en page + page). */
export const getWorkspaceBySlug = cache((slug: string) => getPublicWorkspace(db, slug));

/** Lien calendrier actif (?lien=…) par lequel arrive le visiteur, ou null. */
export const getCalendarLink = cache((workspaceId: string, slug: string | undefined) =>
  slug && /^[a-z0-9-]{3,80}$/.test(slug) ? getPublicCalendarLink(db, workspaceId, slug) : null,
);

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
