import { eq, and } from "drizzle-orm";
import { users, connections } from "../db/schema";
import { getDb } from "../db";
import { decryptCredential } from "../crypto";
import { refreshToken as nuvioRefresh } from "../nuvio/client";
import { pullStremio } from "./stremio-pull";
import { pullNuvio } from "./nuvio-pull";
import { pushToStremio } from "./stremio-push";
import { pushToNuvio } from "./nuvio-push";
import type { DrizzleDb } from "../db";



const BATCH = 8;




const MAX_STEPS_PER_CRON = 4;

const PHASES = ["pull-stremio", "pull-nuvio", "push-stremio", "push-nuvio"] as const;
const PULL_PHASES = ["pull-stremio", "pull-nuvio"] as const;
type Phase = (typeof PHASES)[number] | "done";
type ActivePhase = Exclude<Phase, "done">;

export interface SyncCursor {
  phase: Phase;
  offset: number;
  syncStartMs: number;
  stats: { stremioPulled: number; nuvioPulled: number; stremioPushed: number; nuvioPushed: number };
}

async function getStremioAuthKey(db: DrizzleDb, userId: string, env: CloudflareEnv): Promise<string | null> {
  const [conn] = await db.select().from(connections).where(and(eq(connections.userId, userId), eq(connections.provider, "stremio"))).limit(1);
  if (!conn?.credentials) return null;
  const { authKey } = await decryptCredential<{ authKey: string }>(conn.credentials, env.CRED_ENC_KEY);
  return authKey;
}

async function getNuvioCreds(db: DrizzleDb, userId: string, env: CloudflareEnv): Promise<{ accessToken: string; profileId: number } | null> {
  const [conn] = await db.select().from(connections).where(and(eq(connections.userId, userId), eq(connections.provider, "nuvio"))).limit(1);
  if (!conn?.credentials) return null;
  const creds = await decryptCredential<{ accessToken: string; refreshToken: string; profileId: number }>(conn.credentials, env.CRED_ENC_KEY);
  let accessToken = creds.accessToken;
  try {
    accessToken = (await nuvioRefresh(creds.refreshToken)).accessToken;
  } catch {  }
  return { accessToken, profileId: creds.profileId };
}

function newCursor(): SyncCursor {
  return {
    phase: "pull-stremio",
    offset: 0,
    syncStartMs: Date.now(),
    stats: { stremioPulled: 0, nuvioPulled: 0, stremioPushed: 0, nuvioPushed: 0 },
  };
}


export async function syncStep(
  userId: string,
  env: CloudflareEnv,
  cursor: SyncCursor | null,
  mode: "sync" | "pull" = "sync",
): Promise<{ cursor: SyncCursor; done: boolean; progress: number }> {
  const db = getDb(env);
  const phases: readonly ActivePhase[] = mode === "pull" ? PULL_PHASES : PHASES;
  const c: SyncCursor = cursor ?? newCursor();

  if (c.phase === "done") return { cursor: c, done: true, progress: 1 };

  let hasMore = false;

  switch (c.phase) {
    case "pull-stremio": {
      const authKey = await getStremioAuthKey(db, userId, env);
      if (authKey) {
        const r = await pullStremio(db, userId, authKey, c.offset, BATCH);
        c.stats.stremioPulled += r.pulled;
        hasMore = r.hasMore;
      }
      break;
    }
    case "pull-nuvio": {
      const creds = await getNuvioCreds(db, userId, env);
      if (creds) {
        const r = await pullNuvio(db, userId, creds.accessToken, creds.profileId, c.offset, BATCH);
        c.stats.nuvioPulled += r.pulled;
        hasMore = r.hasMore;
      }
      break;
    }
    case "push-stremio": {
      const authKey = await getStremioAuthKey(db, userId, env);
      if (authKey) {
        const r = await pushToStremio(db, userId, BATCH, authKey);
        c.stats.stremioPushed += r.pushed;
        hasMore = r.hasMore;
      }
      break;
    }
    case "push-nuvio": {
      const creds = await getNuvioCreds(db, userId, env);
      if (creds) {
        const r = await pushToNuvio(db, userId, BATCH, creds.accessToken, creds.profileId);
        c.stats.nuvioPushed += r.pushed;
        hasMore = r.hasMore;
      }
      break;
    }
  }

  if (hasMore) {
    c.offset += BATCH;
  } else {
    const idx = phases.indexOf(c.phase as ActivePhase);
    c.phase = idx < phases.length - 1 ? phases[idx + 1] : "done";
    c.offset = 0;
  }

  const done = c.phase === "done";
  if (done) {
    await db.update(connections)
      .set({ lastSyncAt: new Date(), lastError: null, updatedAt: new Date() })
      .where(eq(connections.userId, userId));
  }

  const phaseIdx = done ? phases.length : phases.indexOf(c.phase as ActivePhase);
  return { cursor: c, done, progress: Math.min(1, phaseIdx / phases.length) };
}


export async function runSyncTick(env: CloudflareEnv): Promise<void> {
  const db = getDb(env);
  const allUsers = await db.select().from(users);

  for (const user of allUsers) {
    try {
      if (!user.syncCronEnabled) continue;
      const userConns = await db.select().from(connections).where(eq(connections.userId, user.id));
      const hasStremio = userConns.some((c) => c.provider === "stremio");
      const hasNuvio = userConns.some((c) => c.provider === "nuvio");
      if (!hasStremio || !hasNuvio) continue;

      let cursor: SyncCursor | null = null;
      for (let i = 0; i < MAX_STEPS_PER_CRON; i++) {
        const r = await syncStep(user.id, env, cursor, user.syncCronMode === "pull" ? "pull" : "sync");
        if (r.done) break;
        cursor = r.cursor;
      }
    } catch (e) {
      console.error(`Sync tick failed for user ${user.id}:`, e);
      await db.update(connections)
        .set({ lastError: String(e), updatedAt: new Date() })
        .where(eq(connections.userId, user.id));
    }
  }
}
