import { LOGOTYPE_CID } from "./logotype";
import { NOTCH_FLANK, notchCid } from "./notch";

/*
 * Gabarit des e-mails, dans la DA de l'app (notch v4, tokens de apps/web/src/styles/app.css) :
 * cadre noir de 6 px, notch noir en haut au centre, titres Urbanist, carte blanche pour le
 * récapitulatif, action en pilule. Un e-mail au nom d'un espace prend la teinte sombre de sa
 * marque (comme ses pages publiques). HTML en tableaux et styles en ligne : clients mail.
 */

const FONT = "Urbanist,'Helvetica Neue',Helvetica,Arial,sans-serif";
const MONO = "'Geist Mono',Menlo,Consolas,monospace";

/** Mélange deux couleurs #rrggbb : `weight` de la première (les clients mail ignorent color-mix). */
export function mixColors(first: string, second: string, weight: number): string {
  const channels = (hex: string) =>
    [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) || 0);
  const a = channels(first);
  const b = channels(second);
  return `#${a
    .map((value, index) =>
      Math.round(value * weight + (b[index] ?? 0) * (1 - weight))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`.toUpperCase();
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

interface LayoutInput {
  preheader: string;
  title: string;
  paragraphs: string[];
  /** Récapitulatif en deux colonnes (« Quand », « Où »…), sous les paragraphes. */
  details?: Array<[string, string]>;
  /** Liens sous le récapitulatif (documents joints : règlement, plan d'accès). */
  links?: Array<{ label: string; url: string }>;
  action: { label: string; url: string };
  footnote: string;
  /** E-mail envoyé au nom d'un espace : son nom, sa couleur et son logo (adresse absolue) remplacent la marque Horaya. */
  brand?: { name: string; color: string; textColor: string; logo?: string | null };
}

/** Couleurs de l'e-mail : celles de l'app, ou la teinte de la marque de l'espace (brandStyle des pages publiques). */
function palette(brand: LayoutInput["brand"]) {
  if (!brand) {
    return {
      frame: "#111111",
      bg: "#EDEDEB",
      ink: "#111111",
      text: "#4A4A4A",
      muted: "#8A8A8A",
      line: "#EEEEEC",
      button: "#111111",
      onButton: "#F7F5F3",
    };
  }
  const ink = mixColors(brand.color, "#111111", 0.16);
  const bg = mixColors(brand.color, "#F6F6F4", 0.05);
  return {
    frame: ink,
    bg,
    ink,
    text: mixColors(ink, bg, 0.8),
    muted: mixColors(ink, bg, 0.5),
    line: mixColors(ink, bg, 0.08),
    button: brand.color,
    onButton: brand.textColor,
  };
}

/** Notch replié de l'app : les deux flancs en S (images de notch.ts) et le centre plein. */
function notchHtml(content: string, frame: string): string {
  const flank = (side: "left" | "right") =>
    `<td width="${NOTCH_FLANK.width}" style="width:${NOTCH_FLANK.width}px;padding:0;font-size:0;line-height:0;vertical-align:top"><img src="cid:${notchCid(side, frame)}" width="${NOTCH_FLANK.width}" height="${NOTCH_FLANK.height}" alt="" style="display:block;width:${NOTCH_FLANK.width}px;height:${NOTCH_FLANK.height}px;border:0"></td>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>${flank("left")}<td height="${NOTCH_FLANK.height}" style="height:${NOTCH_FLANK.height}px;padding:0 4px;background:${frame};vertical-align:middle;white-space:nowrap">${content}</td>${flank("right")}</tr></table>`;
}

/** Gabarit commun des e-mails transactionnels. */
export function renderEmail({
  preheader,
  title,
  paragraphs,
  details = [],
  links = [],
  action,
  footnote,
  brand,
}: LayoutInput): {
  html: string;
  text: string;
} {
  const color = palette(brand);
  const body = paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 14px;font-size:16px;line-height:24px;color:${color.text}">${escapeHtml(paragraph)}</p>`,
    )
    .join("");
  const recap = details.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 4px;background:#FFFFFF;border-radius:20px"><tr><td style="padding:4px 20px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${details
        .map(([label, value], index) => {
          const border = index < details.length - 1 ? `border-bottom:1px solid ${color.line};` : "";
          return `<tr><td style="${border}padding:13px 12px 13px 0;font-family:${MONO};font-size:11px;line-height:18px;letter-spacing:0.06em;text-transform:uppercase;color:${color.muted};width:112px;vertical-align:top">${escapeHtml(label)}</td><td style="${border}padding:13px 0;font-size:15px;line-height:20px;font-weight:600;color:${color.ink}">${escapeHtml(value)}</td></tr>`;
        })
        .join("")}</table>
</td></tr></table>`
    : "";
  const linkList = links.length
    ? `<p style="margin:16px 0 0;font-size:15px;line-height:24px;color:${color.text}">${links
        .map(
          (link) =>
            `<a href="${escapeHtml(link.url)}" style="font-weight:600;color:${color.ink};text-decoration:underline">${escapeHtml(link.label)}</a>`,
        )
        .join("<br>")}</p>`
    : "";
  const notch = brand
    ? `${brand.logo ? `<img src="${escapeHtml(brand.logo)}" width="24" height="24" alt="" style="display:inline-block;width:24px;height:24px;border:0;border-radius:7px;vertical-align:middle;margin-right:10px">` : ""}<span style="font-size:14px;line-height:24px;font-weight:600;vertical-align:middle;color:#F7F5F3">${escapeHtml(brand.name)}</span>`
    : `<img src="cid:${LOGOTYPE_CID}" width="88" height="14" alt="Horaya" style="display:block;width:88px;height:14px;border:0">`;
  const footer = brand
    ? `<tr><td align="center" style="padding:16px 0 0;font-size:12px;line-height:18px;color:${color.muted}">Réservations propulsées par Horaya</td></tr>`
    : "";

  const html = `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Urbanist:wght@500;600;700&family=Geist+Mono:wght@500&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:${color.bg};font-family:${FONT}">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${color.bg};padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="background:${color.frame};border-radius:28px;padding:6px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${color.bg};border-radius:22px">
<tr><td align="center" style="padding:0">${notchHtml(notch, color.frame)}</td></tr>
<tr><td style="padding:36px 28px 30px">
<h1 style="margin:0 0 20px;font-family:${FONT};font-weight:500;font-size:32px;line-height:38px;letter-spacing:-0.02em;color:${color.ink}">${escapeHtml(title)}</h1>
${body}
${recap}
${linkList}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 26px"><tr>
<td style="background:${color.button};border-radius:999px"><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:14px 24px;font-family:${FONT};font-size:15px;line-height:20px;font-weight:600;color:${color.onButton};text-decoration:none;border-radius:999px">${escapeHtml(action.label)} →</a></td>
</tr></table>
<p style="margin:0;font-size:13px;line-height:19px;color:${color.muted}">${escapeHtml(footnote)}</p>
</td></tr>
</table>
</td></tr>
${footer}
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    title,
    "",
    ...paragraphs,
    ...(details.length ? ["", ...details.map(([label, value]) => `${label} : ${value}`)] : []),
    ...(links.length ? ["", ...links.map((link) => `${link.label} : ${link.url}`)] : []),
    "",
    `${action.label} : ${action.url}`,
    "",
    footnote,
    ...(brand ? ["", "Réservations propulsées par Horaya"] : []),
  ].join("\n");

  return { html, text };
}
