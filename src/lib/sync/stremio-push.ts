import { eq, and, or, gt, isNull, inArray, sql } from "drizzle-orm";
import { watchState, pushLog, media } from "../db/schema";
import { datastoreGet, datastorePut } from "../stremio/datastore";
import { computeFingerprint } from "./merge";
import type { DrizzleDb } from "../db";
import type { StremioLibraryItem } from "../stremio/client";

const itemKeyExpr = sql`${watchState.mediaId} || ':' || COALESCE(CAST(${watchState.season} AS TEXT), 'null') || ':' || COALESCE(CAST(${watchState.episode} AS TEXT), 'null')`;

export async function pushToStremio(
  db: DrizzleDb,
  userId: string,
  limit: number,
  authKey: string,
): Promise<{ pushed: number; hasMore: boolean }> {
  const rows = await db
    .select()
    .from(watchState)
    .leftJoin(pushLog, and(
      eq(pushLog.userId, watchState.userId),
      eq(pushLog.provider, "stremio"),
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

  const byMedia = new Map<string, typeof states>();
  for (const ws of states) {
    const group = byMedia.get(ws.mediaId) ?? [];
    group.push(ws);
    byMedia.set(ws.mediaId, group);
  }

  let pushed = 0;
  for (const [mediaId, group] of byMedia) {
    const m = mediaMap.get(mediaId);
    if (!m?.imdbId) continue;

    const [existing] = await datastoreGet(authKey, [m.imdbId]);
    const now = new Date().toISOString();
    const type = m.type === "movie" ? "movie" : "series";
    const newest = group.reduce((a, b) => (a.lastWatchedAt && b.lastWatchedAt && a.lastWatchedAt > b.lastWatchedAt) ? a : b);

    const base: StremioLibraryItem = existing ?? {
      _id: m.imdbId,
      name: m.title ?? m.imdbId,
      type,
      poster: "",
      posterShape: "poster",
      removed: false,
      temp: false,
      _ctime: newest.lastWatchedAt?.toISOString() ?? now,
      state: {},
    };

    const item: StremioLibraryItem = {
      ...base,
      _id: m.imdbId,
      type,
      name: base.name ?? m.title ?? m.imdbId,
      posterShape: base.posterShape ?? "poster",
      removed: base.removed ?? false,
      _mtime: now,
      state: {
        lastWatched: newest.lastWatchedAt?.toISOString() ?? base.state.lastWatched ?? null,
        timeWatched: base.state.timeWatched ?? 0,
        timeOffset: newest.positionMs,
        overallTimeWatched: base.state.overallTimeWatched ?? 0,
        timesWatched: newest.timesWatched ?? base.state.timesWatched ?? 0,
        flaggedWatched: newest.watched ? 1 : 0,
        duration: newest.durationMs,
        video_id: newest.season !== null && newest.episode !== null
          ? `${m.imdbId}:${newest.season}:${newest.episode}`
          : base.state.video_id,
        watched: base.state.watched ?? "",
        noNotif: base.state.noNotif ?? false,
      },
    };

    try {
      await datastorePut(authKey, [item]);
      pushed += group.length;
    } catch (e) {
      console.error(`Stremio push failed for ${m.imdbId}:`, e);
    }
  }

  for (const ws of states) {
    const fp = computeFingerprint(ws.watched, ws.positionMs, ws.durationMs);
    await db.insert(pushLog).values({
      id: crypto.randomUUID(), userId, provider: "stremio",
      itemKey: `${ws.mediaId}:${ws.season}:${ws.episode}`,
      fingerprint: fp, pushedAt: new Date(),
    }).onConflictDoUpdate({
      target: [pushLog.userId, pushLog.provider, pushLog.itemKey],
      set: { fingerprint: fp, pushedAt: new Date() },
    });
  }

  return { pushed, hasMore };
}
