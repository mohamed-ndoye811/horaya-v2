import { pingDatabase } from "@horaya/db";
import { db } from "@/server/db";

/** Sonde Kubernetes : l'app répond et la base aussi. */
export async function GET() {
  return (await pingDatabase(db))
    ? Response.json({ status: "ok" })
    : Response.json({ status: "database_unavailable" }, { status: 503 });
}

export const dynamic = "force-dynamic";
