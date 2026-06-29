import { eq, and } from "drizzle-orm";
import { connections, media, videoIndex, watchState, pushLog } from "../db/schema";
import { datastoreMeta, datastoreGet } from "../stremio/datastore";
import { bulkVideoIds, getMeta, posterUrl } from "../metadata/cinemeta";
import { computeFingerprint, findWatchStateRow, isStalePull } from "./merge";
import type { DrizzleDb } from "../db";

function parseVideoId(videoId: string): { season: number | null; episode: number | null } {
  const parts = videoId.split(":");
  if (parts.length >= 3) return { season: parseInt(parts[1], 10), episode: parseInt(parts[2], 10) };
  return { season: null, episode: null };
}


export async function pullStremio(
  db: DrizzleDb,
  userId: string,
  authKey: string,
  offset: number,
  limit: number,
): Promise<{ pulled: number; hasMore: boolean }> {
  const [conn] = await db.select().from(connections).where(and(eq(connections.userId, userId), eq(connections.provider, "stremio"))).limit(1);
  if (!conn?.credentials) throw new Error("No Stremio connection");

  const cursors = (conn.cursors ?? {}) as { stremio?: { mtimeById?: Record<string, number> } };
  const storedMt = cursors.stremio?.mtimeById ?? {};
  const firstPull = Object.keys(storedMt).length === 0;

  const metaEntries = await datastoreMeta(authKey, "libraryItem");
  const changedIds: string[] = [];
  const newMtimeById: Record<string, number> = {};
  for (const [id, mtime] of metaEntries) {
    newMtimeById[id] = mtime;
    if (!storedMt[id] || storedMt[id] < mtime) changedIds.push(id);
  }

  const batchIds = changedIds.slice(offset, offset + limit);
  const hasMore = offset + limit < changedIds.length;

  
  if (batchIds.length === 0) {
    await db.update(connections).set({ cursors: { stremio: { mtimeById: newMtimeById } }, lastSyncAt: new Date(), lastError: null, updatedAt: new Date() }).where(eq(connections.id, conn.id));
    return { pulled: 0, hasMore: false };
  }

  const items = await datastoreGet(authKey, batchIds);
  const seriesIds = items.filter((i) => i.type === "series" && i._id.startsWith("tt")).map((i) => i._id);
  const videoIdsMap = seriesIds.length > 0 ? await bulkVideoIds(seriesIds) : new Map<string, string[]>();

  let upserted = 0;
  for (const item of items) {
    if (item.removed) continue;
    if (firstPull) {
      const position = item.state.timeOffset ?? 0;
      const duration = item.state.duration ?? 0;
      if (item.state.flaggedWatched || position <= 0 || duration <= 0 || position >= duration) continue;
    }
    const imdbId = item._id.startsWith("tt") ? item._id : null;
    const mediaType = item.type;
    const [existingMedia] = imdbId ? await db.select().from(media).where(eq(media.imdbId, imdbId)).limit(1) : [null];
    const meta = imdbId ? await getMeta(imdbId, mediaType === "movie" ? "movie" : "series").catch(() => null) : null;

    let mediaId = existingMedia?.id;
    if (!mediaId) {
      mediaId = crypto.randomUUID();
      await db.insert(media).values({
        id: mediaId,
        imdbId,
        type: mediaType,
        title: meta?.name ?? item._id,
        year: meta?.year ? parseInt(meta.year, 10) || null : null,
        posterUrl: meta?.poster ?? (imdbId ? posterUrl(imdbId) : null),
        status: meta?.status,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoNothing();
    } else if (existingMedia && meta && (!existingMedia.title || existingMedia.title === imdbId || !existingMedia.posterUrl)) {
      await db.update(media).set({
        title: meta.name,
        year: meta.year ? parseInt(meta.year, 10) || existingMedia.year : existingMedia.year,
        posterUrl: meta.poster ?? existingMedia.posterUrl ?? posterUrl(imdbId!),
        status: meta.status ?? existingMedia.status,
        updatedAt: new Date(),
      }).where(eq(media.id, mediaId));
    }

    if (mediaType === "series" && videoIdsMap.has(item._id)) {
      for (const vid of videoIdsMap.get(item._id)!) {
        const { season, episode } = parseVideoId(vid);
        await db.insert(videoIndex).values({ id: crypto.randomUUID(), mediaId, videoId: vid, season, episode }).onConflictDoNothing();
      }
    }
    upserted += await upsertWatchFromItem(db, userId, mediaId, item);
  }

  
  
  if (!hasMore) {
    await db.update(connections).set({ cursors: { stremio: { mtimeById: newMtimeById } }, lastSyncAt: new Date(), lastError: null, updatedAt: new Date() }).where(eq(connections.id, conn.id));
  }
  return { pulled: upserted, hasMore };
}

async function upsertWatchFromItem(db: DrizzleDb, userId: string, mediaId: string, item: { _id: string; type: string; state: { timeOffset?: number; duration?: number; video_id?: string; lastWatched?: string | null; timesWatched?: number; flaggedWatched?: number; watched?: string } }): Promise<number> {
  const fp = computeFingerprint(!!item.state.flaggedWatched, item.state.timeOffset ?? 0, item.state.duration ?? 0);
  const { season, episode } = item.state.video_id ? parseVideoId(item.state.video_id) : { season: null, episode: null };
  const itemKey = `${mediaId}:${season}:${episode}`;

  const [recentPush] = await db.select().from(pushLog).where(and(eq(pushLog.userId, userId), eq(pushLog.itemKey, itemKey))).limit(1);
  if (recentPush?.fingerprint === fp) return 0;

  
  
  const incoming = item.state.lastWatched ? new Date(item.state.lastWatched) : null;
  const existing = await findWatchStateRow(db, userId, mediaId, season, episode);
  if (existing && isStalePull(existing.lastWatchedAt, incoming)) return 0;

  await db.insert(watchState).values({
    id: crypto.randomUUID(), userId, mediaId, season, episode,
    watched: !!item.state.flaggedWatched,
    positionMs: item.state.timeOffset ?? 0,
    durationMs: item.state.duration ?? 0,
    lastWatchedAt: item.state.lastWatched ? new Date(item.state.lastWatched) : null,
    timesWatched: item.state.timesWatched ?? 0,
    createdAt: new Date(), updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: [watchState.userId, watchState.mediaId, watchState.season, watchState.episode],
    set: {
      watched: !!item.state.flaggedWatched,
      positionMs: item.state.timeOffset ?? 0,
      durationMs: item.state.duration ?? 0,
      lastWatchedAt: item.state.lastWatched ? new Date(item.state.lastWatched) : null,
      timesWatched: item.state.timesWatched ?? 0,
      updatedAt: new Date(),
    },
  });
  return 1;
}
