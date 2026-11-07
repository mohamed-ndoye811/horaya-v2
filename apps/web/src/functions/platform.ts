import { BILLING_RATES } from "@horaya/core";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { formDataInput } from "@/lib/form-data";
import {
  changeRate,
  deletePlatformWorkspace,
  deleteUserAccount,
  grantLicence,
  impersonateUser,
  platformHome,
  platformUsers,
  platformWorkspace,
  revokeLicence,
  suspendUser,
} from "@/server/platform";

/** Cockpit de la plateforme (équipe Horaya) : espaces, comptes, licences et tarifs. */
export const getPlatformHome = createServerFn({ method: "GET" })
  .validator(z.string().max(100).optional())
  .handler(({ data }) => platformHome(data));

export const getPlatformWorkspace = createServerFn({ method: "GET" })
  .validator(z.uuid())
  .handler(({ data }) => platformWorkspace(data));

export const getPlatformUsers = createServerFn({ method: "GET" })
  .validator(z.string().max(100).optional())
  .handler(({ data }) => platformUsers(data));

export const grantPlatformLicence = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => grantLicence(data));

export const revokePlatformLicence = createServerFn({ method: "POST" })
  .validator(z.object({ organizationId: z.uuid(), grantId: z.uuid() }))
  .handler(({ data }) => revokeLicence(data.organizationId, data.grantId));

export const setPlatformRate = createServerFn({ method: "POST" })
  .validator(z.object({ organizationId: z.uuid(), rate: z.enum(BILLING_RATES) }))
  .handler(({ data }) => changeRate(data.organizationId, data.rate));

export const suspendPlatformUser = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.uuid(), suspended: z.boolean() }))
  .handler(({ data }) => suspendUser(data.userId, data.suspended));

export const impersonatePlatformUser = createServerFn({ method: "POST" })
  .validator(z.uuid())
  .handler(({ data }) => impersonateUser(data));

export const deletePlatformUser = createServerFn({ method: "POST" })
  .validator(z.uuid())
  .handler(({ data }) => deleteUserAccount(data));

export const deletePlatformSpace = createServerFn({ method: "POST" })
  .validator(z.object({ organizationId: z.uuid(), confirm: z.string().max(100) }))
  .handler(({ data }) => deletePlatformWorkspace(data.organizationId, data.confirm));
