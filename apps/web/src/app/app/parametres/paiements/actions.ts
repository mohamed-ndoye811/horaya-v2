"use server";

import { connectPaymentAccount } from "@horaya/core";
import { redirect } from "next/navigation";
import { absoluteUrl } from "@/server/mailer";
import { paymentDeps } from "@/server/payments";
import { getWorkspaceContext } from "@/server/workspace";

/** « Connecter Stripe » : vers l'activation du compte de l'organisateur chez Stripe. */
export async function connectStripeAction() {
  const { actor, user, workspace } = await getWorkspaceContext();
  const deps = paymentDeps;
  if (!deps) redirect("/app/parametres/paiements");
  let url: string;
  try {
    ({ url } = await connectPaymentAccount(deps, actor, {
      email: user.email,
      businessName: workspace.name,
      returnUrl: absoluteUrl("/app/parametres/paiements/stripe"),
      refreshUrl: absoluteUrl("/app/parametres/paiements/stripe?relancer=1"),
    }));
  } catch (error) {
    console.error("Connexion Stripe", error);
    redirect("/app/parametres/paiements?stripe=erreur");
  }
  redirect(url);
}
