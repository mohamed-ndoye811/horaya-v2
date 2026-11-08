import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { formDataInput } from "@/lib/form-data";
import { searchText } from "@/lib/search-params";
import type { FormState } from "@/server/form-state";
import {
  adjustGiftCardAction as adjust,
  cancelGiftCardAction as cancel,
  giftCardDetailPage,
  giftCardPurchasePage,
  giftCardSettingsPage,
  giftCardsListPage,
  giftCardViewPage,
  markGiftCardPaidAction as markPaid,
  purchaseGiftCardPublic,
  saveGiftCardSettings as saveSettings,
  sellGiftCard as sell,
} from "@/server/gift-cards";

const id = z.string().uuid();
const slug = z.string().max(80);

/** Liste des bons de l'espace. */
export const giftCardsSearch = z.object({ q: searchText });
export const getGiftCards = createServerFn({ method: "GET" })
  .validator(giftCardsSearch)
  .handler(({ data }) => giftCardsListPage(data.q));

export const getGiftCard = createServerFn({ method: "GET" })
  .validator(id)
  .handler(({ data }) => giftCardDetailPage(data));

export const getGiftCardSettings = createServerFn({ method: "GET" }).handler(() =>
  giftCardSettingsPage(),
);

/** Pages publiques : l'achat, et le bon retrouvé par son jeton. */
export const getGiftCardPurchase = createServerFn({ method: "GET" })
  .validator(slug)
  .handler(({ data }) => giftCardPurchasePage(data));

export const getGiftCardView = createServerFn({ method: "GET" })
  .validator(z.object({ slug, token: z.string().max(100) }))
  .handler(({ data }) => giftCardViewPage(data.slug, data.token));

/* ---------- Actions ---------- */

const settingsFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => saveSettings(data));
const sellFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => sell(data));
const purchaseFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => purchaseGiftCardPublic(String(data.get("_slug") ?? ""), data));
const markPaidFn = createServerFn({ method: "POST" })
  .validator(id)
  .handler(({ data }) => markPaid(data));
const cancelFn = createServerFn({ method: "POST" })
  .validator(z.object({ id, reason: z.string().max(500) }))
  .handler(({ data }) => cancel(data.id, data.reason));
const adjustFn = createServerFn({ method: "POST" })
  .validator(z.object({ id, amount: z.string().max(20), note: z.string().max(300) }))
  .handler(({ data }) => adjust(data.id, data.amount, data.note));

export function saveGiftCardSettingsAction(_previous: FormState, form: FormData) {
  return settingsFn({ data: form });
}
export function sellGiftCardAction(_previous: FormState, form: FormData) {
  return sellFn({ data: form });
}
export function purchaseGiftCardAction(slug: string, _previous: FormState, form: FormData) {
  form.set("_slug", slug);
  return purchaseFn({ data: form });
}
export const markGiftCardPaidAction = (giftCardId: string) => markPaidFn({ data: giftCardId });
export const cancelGiftCardAction = (giftCardId: string, reason: string) =>
  cancelFn({ data: { id: giftCardId, reason } });
export const adjustGiftCardAction = (giftCardId: string, amount: string, note: string) =>
  adjustFn({ data: { id: giftCardId, amount, note } });
