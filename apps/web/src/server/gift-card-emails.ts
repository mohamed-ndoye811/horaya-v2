import type { ActivityEntry } from "@horaya/core";
import { getGiftCardDetail, getGiftCardSettings, getWorkspaceSettings } from "@horaya/db";
import { giftCardEmail, teamGiftCardEmail } from "@horaya/mail";
import { textOn } from "@/lib/colors";
import { formatMoney } from "@/lib/format";
import { notifyTeam } from "./booking-emails";
import { db } from "./db";
import { absoluteUrl, mailer } from "./mailer";

/** Bon payé : e-mail à l'acheteur, et au bénéficiaire s'il est renseigné (branché sur la fin des transactions). */
export async function notifyGiftCardActivity(entries: ActivityEntry[]) {
  for (const entry of entries) {
    if (entry.entityType === "gift_card" && entry.action === "gift_card.purchased") {
      if (entry.actorType === "customer") await notifyTeamOfPurchase(entry);
      continue;
    }
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

/** Achat en ligne : l'équipe est prévenue (e-mail et cloche) selon « Bon cadeau acheté ». */
async function notifyTeamOfPurchase(entry: ActivityEntry) {
  const [detail, workspace] = await Promise.all([
    getGiftCardDetail(db, entry.organizationId, entry.entityId, new Date()),
    getWorkspaceSettings(db, entry.organizationId),
  ]);
  const card = detail?.card;
  if (!card || !workspace) return;
  const amount = formatMoney(card.initialCents);
  const link = `/app/bons-cadeaux/${card.id}`;
  await notifyTeam(
    entry.organizationId,
    "gift_card_purchased",
    teamGiftCardEmail({
      workspaceName: workspace.name,
      purchaserName: card.purchaserName,
      recipientName: card.recipientName,
      amount,
      code: card.code,
      status: card.status === "pending" ? "en attente de paiement" : "payé",
      url: absoluteUrl(link),
    }),
    {
      title: `Bon cadeau acheté · ${amount}`,
      body: `${card.purchaserName} · pour ${card.recipientName}`,
      link,
    },
  );
}
