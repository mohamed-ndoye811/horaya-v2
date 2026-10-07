import { getPublicWorkspace } from "@horaya/db";
import { cache } from "react";
import { db } from "./db";

/** Espace d'une page publique, lu une fois par rendu (mise en page + page). */
export const getWorkspaceBySlug = cache((slug: string) => getPublicWorkspace(db, slug));
