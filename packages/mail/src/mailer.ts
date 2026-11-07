import nodemailer from "nodemailer";
import { LOGOTYPE_CID, LOGOTYPE_PNG_BASE64 } from "./logotype";

/** Le logotype voyage dans l'e-mail (image intégrée) : rien à héberger, affiché par Gmail. */
const logotype = {
  filename: "horaya.png",
  content: Buffer.from(LOGOTYPE_PNG_BASE64, "base64"),
  contentType: "image/png",
  cid: LOGOTYPE_CID,
};

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export interface Mailer {
  send(to: string, content: EmailContent): Promise<void>;
}

/** Envoi SMTP : Mailpit en local, n'importe quel fournisseur SMTP en production. */
export function createSmtpMailer(options: { url: string; from: string }): Mailer {
  const transport = nodemailer.createTransport(options.url);
  return {
    async send(to, { subject, html, text }) {
      await transport.sendMail({
        from: options.from,
        to,
        subject,
        html,
        text,
        attachments: html.includes(`cid:${LOGOTYPE_CID}`) ? [logotype] : [],
      });
    },
  };
}

/** Sans SMTP configuré : écrit l'e-mail dans la console (liens cliquables en dev). */
export function createConsoleMailer(): Mailer {
  return {
    async send(to, { subject, text }) {
      console.info(`\n✉️  ${subject} → ${to}\n${text}\n`);
    },
  };
}
