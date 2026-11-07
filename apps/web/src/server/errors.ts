import { randomUUID } from "node:crypto";
import { framesOf, parseDsn } from "@/lib/sentry-protocol";
import { env } from "./env";

/*
 * Suivi des erreurs : GlitchTip, par le protocole de Sentry (« store »), sans SDK. Sans
 * SENTRY_DSN (postes locaux), rien ne part. Les `console.error` du serveur remontent aussi :
 * tous les « catch » qui journalisent (webhooks, e-mails, stockage…) sont suivis tels quels.
 */

const target = parseDsn(env.SENTRY_DSN);
export const errorTracking = target !== null;

/** Signale une erreur inattendue (serveur, navigateur). Ne lève jamais. */
export function reportError(error: unknown, context: Record<string, unknown> = {}): void {
  if (!target) return;
  const err = error instanceof Error ? error : new Error(String(error));
  const event = {
    event_id: randomUUID().replaceAll("-", ""),
    timestamp: Date.now() / 1000,
    level: "error",
    platform: "node",
    environment: env.SENTRY_ENVIRONMENT,
    exception: {
      values: [{ type: err.name, value: err.message, stacktrace: { frames: framesOf(err.stack) } }],
    },
    extra: context,
  };
  fetch(target.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=horaya/1.0, sentry_key=${target.key}`,
    },
    body: JSON.stringify(event),
  }).catch(() => undefined);
}

if (target) {
  // Tout `console.error(…, erreur)` du serveur est aussi signalé (une fois par appel).
  const original = console.error;
  console.error = (...args: unknown[]) => {
    original(...args);
    const error = args.find((arg) => arg instanceof Error);
    const message = args.filter((arg) => typeof arg === "string").join(" ");
    reportError(error ?? new Error(message || "console.error"), error ? { message } : {});
  };
}
