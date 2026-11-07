/** Bons cadeaux : logique serveur de l'admin et des pages publiques (voir functions/gift-cards.ts). */
import {
  adjustGiftCard,
  cancelGiftCard,
  markGiftCardPaid,
  purchaseGiftCard,
  updateGiftCardSettings,
} from "@horaya/core";
import {
  getGiftCardByViewToken,
  getGiftCardDetail,
  getGiftCardSettings,
  listGiftCards,
  listUsableGiftCardsForEmail,
} from "@horaya/db";
import { notFound, redirect } from "@tanstack/react-router";
import { centsToInput, parseEuroToCents } from "@/lib/money";
import { db } from "./db";
import { type FormState, toFormState } from "./form-state";
import { getWorkspaceBySlug } from "./public";
import { clientIp, rateLimited } from "./rate-limit";
import { deps } from "./services";
import { getWorkspaceContext } from "./workspace";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/** « 30, 50, 100 » → centimes ; une valeur invalide donne NaN (refusée par le core). */
const parseAmounts = (value: string) =>
  value
    .split(/[;,\s]+/)
    .filter(Boolean)
    .map(parseEuroToCents);

/* ---------- Admin : lectures ---------- */

export async function giftCardsListPage(search: string | undefined) {
  const { workspace, timeZone, actor } = await getWorkspaceContext();
  const [cards, settings] = await Promise.all([
    listGiftCards(db, workspace.id, new Date(), search),
    getGiftCardSettings(db, workspace.id),
  ]);
  return { cards, enabled: settings.enabled, timeZone, slug: workspace.slug, role: actor.role };
}

export async function giftCardDetailPage(id: string) {
  const { workspace, timeZone } = await getWorkspaceContext();
  const detail = await getGiftCardDetail(db, workspace.id, id, new Date());
  if (!detail) throw notFound();
  return { ...detail, timeZone, slug: workspace.slug };
}

export async function giftCardSettingsPage() {
  const { workspace, actor } = await getWorkspaceContext();
  const settings = await getGiftCardSettings(db, workspace.id);
  return {
    editable: actor.role === "owner" || actor.role === "admin",
    slug: workspace.slug,
    initial: {
      enabled: settings.enabled,
      amounts: settings.amountsCents
        .map((cents) => centsToInput(cents).replace(",00", ""))
        .join(", "),
      customAmount: settings.customAmount,
      min: centsToInput(settings.minCents).replace(",00", ""),
      max: centsToInput(settings.maxCents).replace(",00", ""),
      validityMonths: settings.validityMonths,
      message: settings.message ?? "",
    },
  };
}

/* ---------- Admin : actions ---------- */

export async function saveGiftCardSettings(form: FormData): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    await updateGiftCardSettings(deps, actor, {
      enabled: form.get("enabled") === "on",
      amountsCents: parseAmounts(text(form, "amounts")),
      customAmount: form.get("customAmount") === "on",
      minCents: parseEuroToCents(text(form, "min")),
      maxCents: parseEuroToCents(text(form, "max")),
      validityMonths: Number(text(form, "validityMonths")),
      message: text(form, "message") || null,
    });
  } catch (error) {
    const state = toFormState(error);
    // Les montants proposés se saisissent dans un seul champ.
    if (state.fieldErrors?.amountsCents) state.fieldErrors.amounts = state.fieldErrors.amountsCents;
    return state;
  }
  return { success: "Réglages des bons cadeaux enregistrés." };
}

/** Vente au comptoir : encaissée sur place, le bon est actif tout de suite. */
export async function sellGiftCard(form: FormData): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  let id: string;
  try {
    const card = await purchaseGiftCard(deps, actor, {
      amountCents: parseEuroToCents(text(form, "amount")),
      purchaserName: text(form, "purchaserName"),
      purchaserEmail: text(form, "purchaserEmail"),
      recipientName: text(form, "recipientName"),
      recipientEmail: text(form, "recipientEmail"),
      message: text(form, "message") || null,
      paid: form.get("paid") === "on",
    });
    id = card.id;
  } catch (error) {
    return toFormState(error);
  }
  throw redirect({ href: `/app/bons-cadeaux/${id}` });
}

async function run(work: () => Promise<unknown>, success: string): Promise<FormState> {
  try {
    await work();
  } catch (error) {
    return toFormState(error);
  }
  return { success };
}

export async function markGiftCardPaidAction(id: string) {
  const { actor } = await getWorkspaceContext();
  return run(() => markGiftCardPaid(deps, actor, id), "Paiement noté, le bon est actif.");
}

export async function cancelGiftCardAction(id: string, reason: string) {
  const { actor } = await getWorkspaceContext();
  return run(() => cancelGiftCard(deps, actor, id, reason), "Bon annulé.");
}

export async function adjustGiftCardAction(id: string, amount: string, note: string) {
  const { actor } = await getWorkspaceContext();
  const negative = amount.trim().startsWith("-");
  const cents = parseEuroToCents(amount.replace(/^[-+]\s*/, ""));
  if (!Number.isInteger(cents) || cents <= 0) return { error: "Montant invalide." };
  return run(
    () => adjustGiftCard(deps, actor, id, negative ? -cents : cents, note),
    "Solde ajusté.",
  );
}

/* ---------- Pages publiques ---------- */

/** Page « Offrir un bon cadeau » : introuvable si l'organisateur ne vend pas de bons. */
export async function giftCardPurchasePage(slug: string) {
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) throw notFound();
  const settings = await getGiftCardSettings(db, workspace.id);
  if (!settings.enabled) throw notFound();
  return { workspace, settings };
}

export async function purchaseGiftCardPublic(slug: string, form: FormData): Promise<FormState> {
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) return { error: "Espace introuvable." };
  const blocked = await rateLimited(`giftcard:ip:${await clientIp()}`, 10, 3600);
  if (blocked) return { error: blocked };
  const custom = text(form, "customAmount");
  const chosen = text(form, "amount");
  let viewToken: string;
  try {
    const card = await purchaseGiftCard(
      deps,
      { type: "customer", organizationId: workspace.id },
      {
        amountCents: parseEuroToCents(chosen === "autre" ? custom : chosen),
        purchaserName: text(form, "purchaserName"),
        purchaserEmail: text(form, "purchaserEmail"),
        recipientName: text(form, "recipientName"),
        recipientEmail: text(form, "recipientEmail"),
        message: text(form, "message") || null,
      },
    );
    viewToken = card.viewToken;
  } catch (error) {
    return toFormState(error);
  }
  throw redirect({ href: `/${slug}/bon-cadeau/${viewToken}?nouveau=1` });
}

/** Page du bon (imprimable) retrouvée par son jeton ; confirmation juste après l'achat. */
export async function giftCardViewPage(slug: string, token: string) {
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) throw notFound();
  const card = await getGiftCardByViewToken(db, workspace.id, token, new Date());
  if (!card) throw notFound();
  const settings = await getGiftCardSettings(db, workspace.id);
  return { workspace, card, workspaceMessage: settings.message };
}

/**
 * Point d'accroche de l'espace client (lot 29) : bons utilisables d'un e-mail, acheteur ou
 * bénéficiaire. À appeler depuis une fonction serveur qui a authentifié le client : l'e-mail
 * doit venir de sa session, jamais d'un champ libre (les codes sont des moyens de paiement).
 */
export async function giftCardsForCustomer(organizationId: string, email: string) {
  const cards = await listUsableGiftCardsForEmail(db, organizationId, email, new Date());
  return cards.map(({ id, code, balanceCents, expiresAt }) => ({
    id,
    code,
    balanceCents,
    expiresAt,
  }));
}
