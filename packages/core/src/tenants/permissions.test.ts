import { describe, expect, it } from "vitest";
import { assertMemberCan } from "../shared/actor";
import { ForbiddenError } from "../shared/errors";
import { can } from "./permissions";

describe("can", () => {
  it("réserve la facturation au propriétaire", () => {
    expect(can("owner", "billing", "manage")).toBe(true);
    expect(can("admin", "billing", "manage")).toBe(false);
  });

  it("interdit le remboursement et l'annulation d'événement à l'éditeur", () => {
    expect(can("editor", "booking", "refund")).toBe(false);
    expect(can("editor", "event", "delete")).toBe(false);
    expect(can("editor", "booking", "cancel")).toBe(true);
  });
});

describe("assertMemberCan", () => {
  const member = (role: "viewer" | "editor") => ({
    type: "member" as const,
    organizationId: "org",
    userId: "user",
    memberId: "member",
    role,
  });

  it("refuse une action à un lecteur", () => {
    expect(() => assertMemberCan(member("viewer"), "event", "create")).toThrow(ForbiddenError);
  });

  it("refuse toute action d'équipe à un client", () => {
    expect(() =>
      assertMemberCan({ type: "customer", organizationId: "org" }, "booking", "update"),
    ).toThrow(ForbiddenError);
  });

  it("laisse passer un éditeur sur la création d'événement", () => {
    expect(() => assertMemberCan(member("editor"), "event", "create")).not.toThrow();
  });
});
