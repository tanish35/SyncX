import { eq, and } from "drizzle-orm";
import { connections, media, watchState, pushLog } from "../db/schema";
import * as nuvio from "../nuvio/client";
import { computeFingerprint, findWatchStateRow, isStalePull } from "./merge";
import type { DrizzleDb } from "../db";

type NuvioOp =
  | { kind: "progress"; entry: nuvio.NuvioProgressEntry }
  | { kind: "watched"; item: nuvio.NuvioWatchedItem };


export async function pullNuvio(
  db: DrizzleDb,
  userId: string,
  accessToken: string,
  profileId: number,
  offset: number,
  limit: number,
): Promise<{ pulled: number; hasMore: boolean }> {
  const [conn] = await db.select().from(connections).where(and(eq(connections.userId, userId), eq(connections.provider, "nuvio"))).limit(1);
  if (!conn?.credentials) throw new Error("No Nuvio connection");

  const cursors = (conn.cursors ?? {}) as { nuvio?: { progressCursor?: number; watchedCursor?: number } };
  const hasCursor = cursors.nuvio?.progressCursor !== undefined;

  const ops: NuvioOp[] = [];
  let nextCursors: { progressCursor: number; watchedCursor: number };

  if (!hasCursor) {
    const progress = await nuvio.pullWatchProgress(accessToken, profileId);
    for (const entry of progress) {
      if (entry.position > 0 && entry.duration > 0 && entry.position < entry.duration) {
        ops.push({ kind: "progress", entry });
      }
    }
    
    nextCursors = { progressCursor: -1, watchedCursor: -1 };
  } else {
    const progressDeltas = await nuvio.pullProgressDelta(accessToken, profileId, cursors.nuvio!.progressCursor!);
    for (const delta of progressDeltas) {
      if (delta.event_type === "upsert" && delta.position !== undefined && delta.duration !== undefined && delta.last_watched !== undefined) {
        ops.push({ kind: "progress", entry: {
          content_id: delta.content_id, content_type: delta.content_type,
          video_id: delta.video_id, season: delta.season, episode: delta.episode,
          position: delta.position, duration: delta.duration, last_watched: delta.last_watched,
        } });
      }
    }
    const watchedDeltas = await nuvio.pullWatchedDelta(accessToken, profileId, cursors.nuvio!.watchedCursor!);
    for (const delta of watchedDeltas) {
      if (delta.event_type === "upsert" && delta.watched_at !== undefined) {
        ops.push({ kind: "watched", item: {
          content_id: delta.content_id, content_type: delta.content_type,
          title: delta.title, season: delta.season, episode: delta.episode,
          watched_at: delta.watched_at,
        } });
      }
    }
    nextCursors = {
      progressCursor: progressDeltas.length > 0 ? progressDeltas[progressDeltas.length - 1].event_id : cursors.nuvio!.progressCursor!,
      watchedCursor: watchedDeltas.length > 0 ? watchedDeltas[watchedDeltas.length - 1].event_id : cursors.nuvio!.watchedCursor!,
    };
  }

  const batch = ops.slice(offset, offset + limit);
  const hasMore = offset + limit < ops.length;

  let pulled = 0;
  for (const op of batch) {
    pulled += op.kind === "progress"
      ? await upsertNuvioProgress(db, userId, op.entry)
      : await upsertNuvioWatched(db, userId, op.item);
  }

  if (!hasMore) {
    if (!hasCursor) {
      nextCursors = {
        progressCursor: await nuvio.getProgressDeltaCursor(accessToken, profileId),
        watchedCursor: await nuvio.getWatchedDeltaCursor(accessToken, profileId),
      };
    }
    await db.update(connections).set({ cursors: { nuvio: nextCursors }, lastSyncAt: new Date(), lastError: null, updatedAt: new Date() }).where(eq(connections.id, conn.id));
  }

  return { pulled, hasMore };
}

async function upsertNuvioProgress(db: DrizzleDb, userId: string, entry: nuvio.NuvioProgressEntry): Promise<number> {
  const contentId = entry.content_id;
  const [existingMedia] = await db.select().from(media).where(eq(media.imdbId, contentId)).limit(1);
  let mediaId = existingMedia?.id;
  if (!mediaId) {
    mediaId = crypto.randomUUID();
    await db.insert(media).values({ id: mediaId, imdbId: contentId, type: entry.content_type === "movie" ? "movie" : "series", createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing();
  }

  const fp = computeFingerprint(false, entry.position, entry.duration);
  const itemKey = `${mediaId}:${entry.season ?? null}:${entry.episode ?? null}`;
  const [recentPush] = await db.select().from(pushLog).where(and(eq(pushLog.userId, userId), eq(pushLog.itemKey, itemKey))).limit(1);
  if (recentPush?.fingerprint === fp) return 0;

  
  const existing = await findWatchStateRow(db, userId, mediaId, entry.season ?? null, entry.episode ?? null);
  if (existing && isStalePull(existing.lastWatchedAt, new Date(entry.last_watched))) return 0;

  await db.insert(watchState).values({
    id: crypto.randomUUID(), userId, mediaId,
    season: entry.season ?? null, episode: entry.episode ?? null,
    watched: false, positionMs: entry.position, durationMs: entry.duration,
    lastWatchedAt: new Date(entry.last_watched), timesWatched: 0,
    createdAt: new Date(), updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: [watchState.userId, watchState.mediaId, watchState.season, watchState.episode],
    set: { positionMs: entry.position, durationMs: entry.duration, lastWatchedAt: new Date(entry.last_watched), updatedAt: new Date() },
  });
  return 1;
}

async function upsertNuvioWatched(db: DrizzleDb, userId: string, item: nuvio.NuvioWatchedItem): Promise<number> {
  const contentId = item.content_id;
  const [existingMedia] = await db.select().from(media).where(eq(media.imdbId, contentId)).limit(1);
  let mediaId = existingMedia?.id;
  if (!mediaId) {
    mediaId = crypto.randomUUID();
    await db.insert(media).values({ id: mediaId, imdbId: contentId, type: item.content_type === "movie" ? "movie" : "series", title: item.title, createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing();
  }

  const fp = computeFingerprint(true, 0, 0);
  const itemKey = `${mediaId}:${item.season ?? null}:${item.episode ?? null}`;
  const [recentPush] = await db.select().from(pushLog).where(and(eq(pushLog.userId, userId), eq(pushLog.itemKey, itemKey))).limit(1);
  if (recentPush?.fingerprint === fp) return 0;

  
  
  const existing = await findWatchStateRow(db, userId, mediaId, item.season ?? null, item.episode ?? null);
  if (existing && isStalePull(existing.lastWatchedAt, new Date(item.watched_at))) return 0;

  await db.insert(watchState).values({
    id: crypto.randomUUID(), userId, mediaId,
    season: item.season ?? null, episode: item.episode ?? null,
    watched: true, positionMs: 0, durationMs: 0,
    lastWatchedAt: new Date(item.watched_at), timesWatched: 1,
    createdAt: new Date(), updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: [watchState.userId, watchState.mediaId, watchState.season, watchState.episode],
    set: { watched: true, lastWatchedAt: new Date(item.watched_at), updatedAt: new Date() },
  });
  return 1;
}
