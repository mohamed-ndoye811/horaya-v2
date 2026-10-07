import { sql } from "drizzle-orm";
import type { Executor } from "./client";

/**
 * Compte un essai pour `key` dans une fenêtre de `windowSeconds` et dit s'il reste permis
 * (au plus `limit` essais par fenêtre). Atomique : une seule requête, sûre en concurrence.
 */
export async function consumeRateLimit(
  db: Executor,
  key: string,
  limit: number,
  windowSeconds: number,
  now = new Date(),
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const at = sql`${now.toISOString()}::timestamptz`;
  const rows = await db.execute<{ count: number; window_started_at: string }>(sql`
    insert into rate_limit (key, window_started_at, count) values (${key}, ${at}, 1)
    on conflict (key) do update set
      count = case when rate_limit.window_started_at <= ${at} - make_interval(secs => ${windowSeconds}) then 1 else rate_limit.count + 1 end,
      window_started_at = case when rate_limit.window_started_at <= ${at} - make_interval(secs => ${windowSeconds}) then ${at} else rate_limit.window_started_at end
    returning count, window_started_at`);
  const row = rows[0];
  const count = Number(row?.count ?? 1);
  const started = row ? new Date(row.window_started_at).getTime() : now.getTime();
  return {
    allowed: count <= limit,
    retryAfterSeconds: Math.max(
      0,
      Math.ceil((started + windowSeconds * 1000 - now.getTime()) / 1000),
    ),
  };
}

/** Sonde de santé : la base répond-elle ? */
export async function pingDatabase(db: Executor): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
