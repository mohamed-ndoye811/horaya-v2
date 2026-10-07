import type { WorkspaceDirectory } from "@horaya/core";
import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { organization } from "../schema";

export function workspaceDirectory(db: Db): WorkspaceDirectory {
  return {
    async isSlugTaken(slug) {
      const [existing] = await db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.slug, slug))
        .limit(1);
      return Boolean(existing);
    },
  };
}
