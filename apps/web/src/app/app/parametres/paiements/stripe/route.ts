import { connectPaymentAccount, refreshPaymentAccount } from "@horaya/core";
import { redirect } from "next/navigation";
import { absoluteUrl } from "@/server/mailer";
import { paymentDeps } from "@/server/payments";
import { getWorkspaceContext } from "@/server/workspace";

/** Retour de l'activation Stripe : on relit l'état du compte (ou on relance un lien expiré). */
export async function GET(request: Request) {
  const { actor, user, workspace } = await getWorkspaceContext();
  if (new URL(request.url).searchParams.get("relancer")) {
    const { url } = await connectPaymentAccount(paymentDeps, actor, {
      email: user.email,
      businessName: workspace.name,
      returnUrl: absoluteUrl("/app/parametres/paiements/stripe"),
      refreshUrl: absoluteUrl("/app/parametres/paiements/stripe?relancer=1"),
    });
    redirect(url);
  }
  await refreshPaymentAccount(paymentDeps, workspace.id);
  redirect("/app/parametres/paiements");
}
