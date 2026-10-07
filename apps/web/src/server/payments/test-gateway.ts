import type { PaymentGateway } from "@horaya/core";

const random = () => crypto.randomUUID().replaceAll("-", "").slice(0, 16);

/**
 * Passerelle de test, sans clés Stripe : les pages de paiement et d'activation du compte
 * sont simulées par l'app (/paiement-test), aucune carte n'est débitée.
 */
export function createTestGateway(baseUrl: string): PaymentGateway {
  const url = (path: string, params: Record<string, string>) =>
    `${new URL(path, baseUrl).toString()}?${new URLSearchParams(params).toString()}`;
  return {
    provider: "test",
    createAccount: async () => ({ accountId: `acct_test_${random()}` }),
    createOnboardingLink: async ({ accountId, returnUrl }) => ({
      url: url("/paiement-test/compte", { compte: accountId, retour: returnUrl }),
    }),
    // Un compte de test est actif dès sa création : l'activation est simulée.
    getAccount: async (accountId) => ({
      status: accountId.startsWith("acct_test_") ? "active" : "pending",
      displayName: null,
    }),
    createCheckout: async ({ successUrl, cancelUrl }) => {
      const checkoutId = `cs_test_${random()}`;
      return {
        checkoutId,
        url: url(`/paiement-test/${checkoutId}`, { ok: successUrl, ko: cancelUrl }),
      };
    },
    refund: async () => ({ refundId: `re_test_${random()}` }),
    getBalance: async () => null,
  };
}
