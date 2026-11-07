import nodemailer from "nodemailer";
import { LOGOTYPE_CID, LOGOTYPE_PNG_BASE64 } from "./logotype";
import { NOTCH_CID_PATTERN, notchFlankPng } from "./notch";

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

/** Images intégrées que l'e-mail appelle : logotype et flancs du notch (à la couleur demandée). */
export function inlineImages(html: string) {
  const flanks = [
    ...new Map([...html.matchAll(NOTCH_CID_PATTERN)].map((match) => [match[1], match])).values(),
  ].map(([, cid = "", side, hex]) => ({
    filename: `${cid}.png`,
    content: notchFlankPng(side === "right" ? "right" : "left", `#${hex}`),
    contentType: "image/png",
    cid,
  }));
  return [...(html.includes(`cid:${LOGOTYPE_CID}`) ? [logotype] : []), ...flanks];
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
        attachments: inlineImages(html),
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
