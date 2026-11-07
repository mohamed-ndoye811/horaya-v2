import { describe, expect, it } from "vitest";
import { generateToken, hashToken } from "../shared/tokens";
import {
  customerSessionExpiresAt,
  isLoginLinkUsable,
  LOGIN_LINK_MINUTES,
  loginLinkExpiresAt,
} from "./rules";

const now = new Date("2026-11-08T10:00:00Z");

describe("lien de connexion", () => {
  it("expire 15 minutes après la demande", () => {
    expect(LOGIN_LINK_MINUTES).toBe(15);
    expect(loginLinkExpiresAt(now).toISOString()).toBe("2026-11-08T10:15:00.000Z");
  });

  it("sert une seule fois, et seulement avant son expiration", () => {
    const expiresAt = loginLinkExpiresAt(now);
    expect(isLoginLinkUsable({ expiresAt, usedAt: null }, now)).toBe(true);
    expect(isLoginLinkUsable({ expiresAt, usedAt: now }, now)).toBe(false);
    expect(isLoginLinkUsable({ expiresAt, usedAt: null }, expiresAt)).toBe(false);
  });

  it("n'est jamais stocké en clair : deux jetons différents ont deux empreintes différentes", async () => {
    const [first, second] = [generateToken(), generateToken()];
    expect(first).not.toBe(second);
    expect(await hashToken(first)).not.toBe(first);
    expect(await hashToken(first)).not.toBe(await hashToken(second));
  });
});

describe("session client", () => {
  it("dure 30 jours", () => {
    expect(customerSessionExpiresAt(now).toISOString()).toBe("2026-12-08T10:00:00.000Z");
  });
});
