import { describe, expect, it } from "vitest";
import { invitationEmail, passwordResetEmail } from "./templates";

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
