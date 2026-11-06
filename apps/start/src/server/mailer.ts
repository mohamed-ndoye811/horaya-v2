import { createConsoleMailer, createSmtpMailer, type Mailer } from "@horaya/mail";
import { env } from "./env";

const globalForMailer = globalThis as unknown as { horayaMailer?: Mailer };

/** Envoi des e-mails (Mailpit en local, la console sans SMTP). */
export const mailer: Mailer =
  globalForMailer.horayaMailer ??
  (env.SMTP_URL
    ? createSmtpMailer({ url: env.SMTP_URL, from: env.MAIL_FROM })
    : createConsoleMailer());
if (process.env.NODE_ENV !== "production") globalForMailer.horayaMailer = mailer;

/** Adresse absolue d'une page de l'app (liens des e-mails). */
export const absoluteUrl = (path: string) => new URL(path, env.BETTER_AUTH_URL).toString();
