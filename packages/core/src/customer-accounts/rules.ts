/** Un lien de connexion vaut 15 minutes, une seule fois. */
export const LOGIN_LINK_MINUTES = 15;
/** Une session client dure 30 jours. */
export const CUSTOMER_SESSION_DAYS = 30;

export const loginLinkExpiresAt = (now: Date) =>
  new Date(now.getTime() + LOGIN_LINK_MINUTES * 60_000);

export const customerSessionExpiresAt = (now: Date) =>
  new Date(now.getTime() + CUSTOMER_SESSION_DAYS * 86_400_000);

export function isLoginLinkUsable(
  link: { expiresAt: Date; usedAt: Date | null },
  now: Date,
): boolean {
  return link.usedAt === null && now < link.expiresAt;
}
