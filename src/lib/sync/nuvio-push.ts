import { eq, and, or, gt, isNull, inArray, sql } from "drizzle-orm";
import { watchState, pushLog, media } from "../db/schema";
import * as nuvio from "../nuvio/client";
import { computeFingerprint } from "./merge";
import type { DrizzleDb } from "../db";

const itemKeyExpr = sql`${watchState.mediaId} || ':' || COALESCE(CAST(${watchState.season} AS TEXT), 'null') || ':' || COALESCE(CAST(${watchState.episode} AS TEXT), 'null')`;

export async function pushToNuvio(
  db: DrizzleDb,
  userId: string,
  limit: number,
  accessToken: string,
  profileId: number,
): Promise<{ pushed: number; hasMore: boolean }> {
  const rows = await db
    .select()
    .from(watchState)
    .leftJoin(pushLog, and(
      eq(pushLog.userId, watchState.userId),
      eq(pushLog.provider, "nuvio"),
      sql`${pushLog.itemKey} = ${itemKeyExpr}`,
    ))
    .where(and(
      eq(watchState.userId, userId),
      or(isNull(pushLog.id), gt(watchState.updatedAt, pushLog.pushedAt)),
    ))
    .orderBy(watchState.id)
    .limit(limit);
  if (rows.length === 0) return { pushed: 0, hasMore: false };
  const states = rows.map((r) => r.watchState);
  const hasMore = rows.length === limit;

  const mediaIds = [...new Set(states.map((s) => s.mediaId))];
  const mediaRows = await db.select().from(media).where(inArray(media.id, mediaIds));
  const mediaMap = new Map(mediaRows.map((m) => [m.id, m]));

  const progressEntries: nuvio.NuvioProgressEntry[] = [];
  const watchedItems: nuvio.NuvioWatchedItem[] = [];

  for (const ws of states) {
    const m = mediaMap.get(ws.mediaId);
    if (!m?.imdbId) continue;

    const contentId = m.imdbId;
    const contentType = m.type === "movie" ? "movie" : "series";

    if (ws.watched) {
      watchedItems.push({
        content_id: contentId, content_type: contentType,
        title: m.title ?? undefined,
        season: ws.season ?? undefined, episode: ws.episode ?? undefined,
        watched_at: ws.lastWatchedAt?.getTime() ?? Date.now(),
      });
    } else if (ws.positionMs > 0) {
      progressEntries.push({
        content_id: contentId, content_type: contentType,
        video_id: ws.season !== null && ws.episode !== null ? `${contentId}:${ws.season}:${ws.episode}` : contentId,
        season: ws.season ?? undefined, episode: ws.episode ?? undefined,
        position: ws.positionMs, duration: ws.durationMs,
        last_watched: ws.lastWatchedAt?.getTime() ?? Date.now(),
      });
    }
  }

  let pushed = 0;
  try {
    if (progressEntries.length > 0) {
      await nuvio.pushWatchProgress(accessToken, profileId, progressEntries);
      pushed += progressEntries.length;
    }
    if (watchedItems.length > 0) {
      await nuvio.pushWatchedItems(accessToken, profileId, watchedItems);
      pushed += watchedItems.length;
    }
  } catch (e) {
    
    console.error("Nuvio push batch failed:", e);
    return { pushed: 0, hasMore: false };
  }

  
  
  for (const ws of states) {
    const fp = computeFingerprint(ws.watched, ws.positionMs, ws.durationMs);
    await db.insert(pushLog).values({
      id: crypto.randomUUID(), userId, provider: "nuvio",
      itemKey: `${ws.mediaId}:${ws.season}:${ws.episode}`,
      fingerprint: fp, pushedAt: new Date(),
    }).onConflictDoUpdate({
      target: [pushLog.userId, pushLog.provider, pushLog.itemKey],
      set: { fingerprint: fp, pushedAt: new Date() },
    });
  }

  return { pushed, hasMore };
}
