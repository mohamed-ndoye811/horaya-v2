const INK = "#264489";
const BG = "#F2F0EF";
const SURFACE = "#FAF9F8";
const MUTED = "#4E669D";

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
  action: { label: string; url: string };
  footnote: string;
  /** E-mail envoyé au nom d'un espace : son nom et sa couleur remplacent la marque Horaya. */
  brand?: { name: string; color: string; textColor: string };
}

/** Gabarit commun des e-mails transactionnels (HTML en tableaux, compatible clients mail). */
export function renderEmail({
  preheader,
  title,
  paragraphs,
  details = [],
  action,
  footnote,
  brand,
}: LayoutInput): {
  html: string;
  text: string;
} {
  const body = paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:24px;color:${INK}">${escapeHtml(paragraph)}</p>`,
    )
    .join("");
  const recap = details.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 8px;border-top:1px solid #DCD8D4">${details
        .map(
          ([label, value]) =>
            `<tr><td style="padding:10px 0;border-bottom:1px solid #DCD8D4;font-family:'Geist Mono',Menlo,monospace;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED};width:120px;vertical-align:top">${escapeHtml(label)}</td><td style="padding:10px 0;border-bottom:1px solid #DCD8D4;font-size:15px;font-weight:700;color:${INK}">${escapeHtml(value)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const header = brand
    ? `<td style="background:${brand.color};padding:24px 32px"><span style="font-size:17px;font-weight:800;letter-spacing:0.02em;text-transform:uppercase;color:${brand.textColor}">${escapeHtml(brand.name)}</span></td>`
    : `<td style="background:${INK};padding:28px 32px"><span style="font-family:Archivo,'Arial Narrow',Arial,sans-serif;font-weight:900;font-size:26px;letter-spacing:-0.04em;text-transform:uppercase;color:#F7F5F3">Horaya</span></td>`;

  const html = `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:${BG};font-family:Urbanist,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:40px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr>${header}</tr>
<tr><td style="background:${SURFACE};padding:40px 32px">
<h1 style="margin:0 0 24px;font-family:Archivo,'Arial Narrow',Arial,sans-serif;font-weight:900;font-size:34px;line-height:34px;letter-spacing:-0.04em;text-transform:uppercase;color:${INK}">${escapeHtml(title)}</h1>
${body}
${recap}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr>
<td style="background:${INK}"><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:16px 28px;font-size:16px;font-weight:800;color:#F7F5F3;text-decoration:none">${escapeHtml(action.label)} →</a></td>
</tr></table>
<p style="margin:0;font-size:13px;line-height:18px;color:${MUTED}">${escapeHtml(footnote)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    title.toUpperCase(),
    "",
    ...paragraphs,
    ...(details.length ? ["", ...details.map(([label, value]) => `${label} : ${value}`)] : []),
    "",
    `${action.label} : ${action.url}`,
    "",
    footnote,
  ].join("\n");

  return { html, text };
}
