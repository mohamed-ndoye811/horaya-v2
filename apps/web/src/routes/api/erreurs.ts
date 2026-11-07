import { consumeRateLimit } from "@horaya/db";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/server/db";
import { errorTracking, reportError } from "@/server/errors";

const report = z.object({
  message: z.string().max(1000),
  stack: z.string().max(8000).optional(),
  url: z.string().max(500),
});

/**
 * Erreurs du navigateur (lib/report-error.ts), relayées au suivi des erreurs : pas de SDK ni
 * de DSN côté client. 30 rapports par heure et par adresse au plus.
 */
export const Route = createFileRoute("/api/erreurs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!errorTracking) return new Response(null, { status: 204 });
        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "inconnue";
        const { allowed } = await consumeRateLimit(db, `erreurs:${ip}`, 30, 3600);
        if (!allowed) return new Response(null, { status: 429 });
        const parsed = report.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response(null, { status: 400 });
        const error = new Error(parsed.data.message);
        error.name = "ErreurNavigateur";
        if (parsed.data.stack) error.stack = parsed.data.stack;
        reportError(error, {
          côté: "navigateur",
          url: parsed.data.url,
          navigateur: request.headers.get("user-agent"),
        });
        return new Response(null, { status: 204 });
      },
    },
  },
});
