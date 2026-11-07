import { describe, expect, it } from "vitest";
import { mixColors } from "./layout";
import { customerLoginEmail, invitationEmail, passwordResetEmail } from "./templates";

describe("e-mails transactionnels", () => {
  it("inclut le lien dans les versions HTML et texte", () => {
    const url =
      "https://horaya.app/api/auth/reset-password/abc?callbackURL=%2Fnouveau-mot-de-passe";
    const email = passwordResetEmail({ firstName: "Camille", url });
    expect(email.text).toContain(url);
    expect(email.html).toContain(url.replaceAll("&", "&amp;"));
    expect(email.text).toContain("Bonjour Camille,");
  });

  it("échappe les données saisies par les utilisateurs", () => {
    const email = invitationEmail({
      organizationName: "<script>alert(1)</script>",
      inviterName: "Camille",
      roleLabel: "éditeur",
      url: "https://horaya.app/invitation/1",
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });
});

describe("espace client", () => {
  const url = "https://horaya.app/cabinet-vidal/mon-espace/connexion?jeton=abc";

  it("envoie le lien de connexion aux couleurs de l'espace, notch compris", () => {
    const email = customerLoginEmail({
      url,
      minutes: 15,
      workspace: { name: "Cabinet Vidal", color: "#528D74", textColor: "#F7F5F3" },
    });
    expect(email.subject).toBe("Ton lien de connexion à ton espace chez Cabinet Vidal");
    expect(email.html).toContain(`background:${mixColors("#528D74", "#111111", 0.16)}`);
    expect(email.html).toContain("cid:notch-left-");
    expect(email.text).toContain(`Me connecter : ${url}`);
    expect(email.text).toContain("Réservations propulsées par Horaya");
  });

  it("prend le logotype Horaya sans espace (vue horaya.app)", () => {
    const email = customerLoginEmail({ url, minutes: 15 });
    expect(email.subject).toBe("Ton lien de connexion à ton espace sur Horaya");
    expect(email.html).toContain('src="cid:horaya-logotype"');
  });
});
