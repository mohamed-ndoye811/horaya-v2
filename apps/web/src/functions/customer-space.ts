import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { formDataInput } from "@/lib/form-data";
import {
  allCustomerBookings,
  cancelCustomerBooking,
  currentCustomerAccount,
  customerBookingPage,
  customerHome,
  customerLoginPage,
  customerProfilePage,
  deleteCustomerSpace,
  payCustomerBooking,
  rescheduleCustomerBooking,
  saveCustomerProfile,
  sendCustomerLoginLink,
  signInCustomer,
  signOutCustomerSession,
} from "@/server/customer-space";
import type { FormState } from "@/server/form-state";

/*
 * Espace client (lot 29). `slug` : l'atelier dont on visite l'espace ; null pour la vue
 * horaya.app (maquette 8.5). La session client vient de son propre cookie.
 */
const slug = z.string().max(80);
const space = z.object({ slug: slug.nullable() });
const ofBooking = z.object({ slug, booking: z.uuid() });

export const getCustomerLoginPage = createServerFn({ method: "GET" })
  .validator(z.object({ slug: slug.nullable(), token: z.string().max(200).optional() }))
  .handler(({ data }) => customerLoginPage(data.slug, data.token));

export const getCustomerHome = createServerFn({ method: "GET" })
  .validator(slug)
  .handler(({ data }) => customerHome(data));

export const getCustomerBookingPage = createServerFn({ method: "GET" })
  .validator(ofBooking)
  .handler(({ data }) => customerBookingPage(data.slug, data.booking));

export const getCustomerProfilePage = createServerFn({ method: "GET" })
  .validator(space)
  .handler(({ data }) => customerProfilePage(data.slug));

export const getAllCustomerBookings = createServerFn({ method: "GET" }).handler(() =>
  allCustomerBookings(),
);

/** Vue horaya.app : le notch propose « Se déconnecter » seulement à un client connecté. */
export const getCustomerSignedIn = createServerFn({ method: "GET" }).handler(
  async () => (await currentCustomerAccount()) !== null,
);

/* ---------- Actions ---------- */

const sendLinkFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => sendCustomerLoginLink(String(data.get("_slug") ?? "") || null, data));
const signInFn = createServerFn({ method: "POST" })
  .validator(z.object({ slug: slug.nullable(), token: z.string().min(1).max(200) }))
  .handler(({ data }) => signInCustomer(data.slug, data.token));
const signOutFn = createServerFn({ method: "POST" })
  .validator(space)
  .handler(({ data }) => signOutCustomerSession(data.slug));
const payFn = createServerFn({ method: "POST" })
  .validator(ofBooking)
  .handler(({ data }) => payCustomerBooking(data.slug, data.booking));
const cancelFn = createServerFn({ method: "POST" })
  .validator(ofBooking)
  .handler(({ data }) => cancelCustomerBooking(data.slug, data.booking));
const rescheduleFn = createServerFn({ method: "POST" })
  .validator(ofBooking.extend({ event: z.uuid() }))
  .handler(({ data }) => rescheduleCustomerBooking(data.slug, data.booking, data.event));
const profileFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => saveCustomerProfile(String(data.get("_slug") ?? "") || null, data));
const deleteFn = createServerFn({ method: "POST" })
  .validator(space)
  .handler(({ data }) => deleteCustomerSpace(data.slug));

/** Maquette 8.1 : « Recevoir mon lien de connexion ». */
export function sendCustomerLoginLinkAction(
  slug: string | null,
  _previous: FormState,
  form: FormData,
) {
  form.set("_slug", slug ?? "");
  return sendLinkFn({ data: form });
}

export const signInCustomerAction = (slug: string | null, token: string) =>
  signInFn({ data: { slug, token } });
export const signOutCustomerAction = (slug: string | null) => signOutFn({ data: { slug } });
export const payCustomerBookingAction = (slug: string, booking: string) =>
  payFn({ data: { slug, booking } });
export const cancelCustomerBookingAction = (slug: string, booking: string) =>
  cancelFn({ data: { slug, booking } });
export const rescheduleCustomerBookingAction = (slug: string, booking: string, event: string) =>
  rescheduleFn({ data: { slug, booking, event } });

/** Maquette 8.4 : le profil. */
export function saveCustomerProfileAction(
  slug: string | null,
  _previous: FormState,
  form: FormData,
) {
  form.set("_slug", slug ?? "");
  return profileFn({ data: form });
}

export const deleteCustomerSpaceAction = (slug: string | null) => deleteFn({ data: { slug } });
