import { eq, and, isNull } from "drizzle-orm";
import { watchState, pushLog } from "../db/schema";
import type { DrizzleDb } from "../db";

export interface MergeInput {
  userId: string;
  mediaId: string;
  season: number | null;
  episode: number | null;
  watched: boolean;
  positionMs: number;
  durationMs: number;
  lastWatchedAt: Date | null;
  source: string;
}

export async function findWatchStateRow(
  db: DrizzleDb,
  userId: string,
  mediaId: string,
  season: number | null,
  episode: number | null,
) {
  const [row] = await db
    .select()
    .from(watchState)
    .where(
      and(
        eq(watchState.userId, userId),
        eq(watchState.mediaId, mediaId),
        season === null ? isNull(watchState.season) : eq(watchState.season, season),
        episode === null ? isNull(watchState.episode) : eq(watchState.episode, episode),
      ),
    )
    .limit(1);
  return row;
}

export function isStalePull(
  existingLastWatched: Date | null | undefined,
  incomingLastWatched: Date | null,
): boolean {
  const existingTime = existingLastWatched?.getTime() ?? 0;
  const incomingTime = incomingLastWatched?.getTime() ?? 0;
  return incomingTime <= existingTime;
}

export function computeFingerprint(watched: boolean, positionMs: number, durationMs: number): string {
  const rounded = Math.round(positionMs / 10000);
  const data = `${watched ? 1 : 0}:${rounded}:${durationMs}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
  }
  return `fp_${Math.abs(hash).toString(36)}`;
}

export async function mergeWatchState(db: DrizzleDb, input: MergeInput): Promise<boolean> {
  const fingerprint = computeFingerprint(input.watched, input.positionMs, input.durationMs);

  const [existingPush] = await db
    .select()
    .from(pushLog)
    .where(
      and(
        eq(pushLog.userId, input.userId),
        eq(pushLog.itemKey, `${input.mediaId}:${input.season}:${input.episode}`),
      ),
    )
    .limit(1);

  if (existingPush && existingPush.fingerprint === fingerprint) {
    return false;
  }

  const [existing] = await db
    .select()
    .from(watchState)
    .where(
      and(
        eq(watchState.userId, input.userId),
        eq(watchState.mediaId, input.mediaId),
      ),
    )
    .limit(1);

  if (!existing) {
    await db.insert(watchState).values({
      id: crypto.randomUUID(),
      userId: input.userId,
      mediaId: input.mediaId,
      season: input.season,
      episode: input.episode,
      watched: input.watched,
      positionMs: input.positionMs,
      durationMs: input.durationMs,
      lastWatchedAt: input.lastWatchedAt,
      timesWatched: input.watched ? 1 : 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing();
    return true;
  }

  const existingTime = existing.lastWatchedAt?.getTime() ?? 0;
  const inputTime = input.lastWatchedAt?.getTime() ?? 0;

  if (inputTime <= existingTime) {
    return false;
  }

  const progressRatio = input.durationMs > 0 ? input.positionMs / input.durationMs : 0;
  const keepWatched = existing.watched && progressRatio < 0.9;

  await db
    .update(watchState)
    .set({
      watched: keepWatched ? true : input.watched,
      positionMs: input.positionMs,
      durationMs: input.durationMs,
      lastWatchedAt: input.lastWatchedAt,
      timesWatched: input.watched ? (existing.timesWatched ?? 0) + 1 : existing.timesWatched,
      updatedAt: new Date(),
    })
    .where(eq(watchState.id, existing.id));

  return true;
}
