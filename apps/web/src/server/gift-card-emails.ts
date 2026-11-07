import type { ActivityEntry } from "@horaya/core";
import { getGiftCardDetail, getGiftCardSettings, getWorkspaceSettings } from "@horaya/db";
import { giftCardEmail } from "@horaya/mail";
import { textOn } from "@/lib/colors";
import { formatMoney } from "@/lib/format";
import { db } from "./db";
import { absoluteUrl, mailer } from "./mailer";

/** Bon payé : e-mail à l'acheteur, et au bénéficiaire s'il est renseigné (branché sur la fin des transactions). */
export async function notifyGiftCardActivity(entries: ActivityEntry[]) {
  for (const entry of entries) {
    if (entry.entityType !== "gift_card" || entry.action !== "gift_card.activated") continue;
    const [detail, workspace, settings] = await Promise.all([
      getGiftCardDetail(db, entry.organizationId, entry.entityId, new Date()),
      getWorkspaceSettings(db, entry.organizationId),
      getGiftCardSettings(db, entry.organizationId),
    ]);
    const card = detail?.card;
    if (!card?.expiresAt || !workspace) continue;
    const base = {
      workspace: {
        name: workspace.name,
        color: workspace.brandColor,
        textColor: textOn(workspace.brandColor),
        logo: workspace.logo ? absoluteUrl(workspace.logo) : null,
      },
      purchaserName: card.purchaserName,
      recipientName: card.recipientName,
      code: card.code,
      amount: formatMoney(card.initialCents),
      expiresOn: new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "long",
        timeZone: "Europe/Paris",
      }).format(card.expiresAt),
      message: card.message,
      workspaceMessage: settings.message,
      cardUrl: absoluteUrl(`/${workspace.slug}/bon-cadeau/${card.viewToken}`),
      bookUrl: absoluteUrl(`/${workspace.slug}`),
    };
    const recipients = [
      { to: card.purchaserEmail, audience: "purchaser" as const, firstName: card.purchaserName },
      ...(card.recipientEmail && card.recipientEmail !== card.purchaserEmail
        ? [
            {
              to: card.recipientEmail,
              audience: "recipient" as const,
              firstName: card.recipientName,
            },
          ]
        : []),
    ];
    for (const { to, audience, firstName } of recipients) {
      try {
        await mailer.send(
          to,
          giftCardEmail({ ...base, audience, firstName: firstName.split(" ")[0] ?? firstName }),
        );
      } catch (error) {
        console.error("E-mail du bon cadeau non envoyé", to, error);
      }
    }
  }
}
