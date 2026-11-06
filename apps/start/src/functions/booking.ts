import { getBookingDetail, listBookingPayments } from "@horaya/db";
import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/server/db";
import { integratedPaymentsEnabled } from "@/server/payments/config";
import { getWorkspaceContext } from "@/server/workspace";

/** Données de la fiche réservation (maquette 1.5). */
export const getBooking = createServerFn({ method: "GET" })
  .validator(z.string().uuid())
  .handler(async ({ data: id }) => {
    const { workspace, timeZone, actor } = await getWorkspaceContext();
    const detail = await getBookingDetail(db, workspace.id, id);
    if (!detail) throw notFound();
    const payments = await listBookingPayments(db, detail.booking.id);
    return {
      timeZone,
      detail: {
        ...detail,
        // Données libres du journal (JSON en base) : des valeurs simples, sérialisables.
        activity: detail.activity.map((entry) => ({
          ...entry,
          data: entry.data as Record<string, string | number | boolean | null> | null,
        })),
      },
      payments,
      actor: { type: actor.type, role: actor.role },
      integratedPaymentsEnabled,
    };
  });
