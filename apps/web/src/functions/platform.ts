import { BILLING_RATES } from "@horaya/core";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { formDataInput } from "@/lib/form-data";
import {
  changeRate,
  grantLicence,
  platformHome,
  platformUsers,
  platformWorkspace,
  revokeLicence,
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
