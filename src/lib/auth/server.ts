import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, connections } from "@/lib/db/schema";

const COOKIE_NAME = "syncx_session";

export async function getServerSession(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME);
  if (!sessionCookie) return null;

  const env = getCloudflareContext().env as CloudflareEnv;
  const key = new TextEncoder().encode(env.SESSION_SECRET);

  try {
    const { payload } = await jwtVerify(sessionCookie.value, key);
    const userId = payload.userId as string;
    if (!userId) return null;
    return { userId };
  } catch {
    return null;
  }
}

export interface ServerUser {
  userId: string;
  email: string | null;
  notificationEmail: string | null;
  notifyEmails: boolean;
  syncCronEnabled: boolean;
  stremioConnected: boolean;
  nuvioConnected: boolean;
  lastSyncAt: Date | null;
  nuvioProfileId: string | null;
}

export async function getServerUser(): Promise<ServerUser | null> {
  const session = await getServerSession();
  if (!session) return null;

  const env = getCloudflareContext().env as CloudflareEnv;
  const db = getDb(env);

  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .get();

  if (!user) return null;

  const conns = await db
    .select()
    .from(connections)
    .where(eq(connections.userId, session.userId))
    .all();

  const stremioConn = conns.find((c) => c.provider === "stremio");
  const nuvioConn = conns.find((c) => c.provider === "nuvio");

  const syncDates = conns
    .map((c) => c.lastSyncAt)
    .filter((d): d is Date => d !== null);
  const lastSyncAt = syncDates.length
    ? new Date(Math.max(...syncDates.map((d) => d.getTime())))
    : null;

  const nuvioProfileId = nuvioConn?.metadata
    ? (nuvioConn.metadata as Record<string, unknown>).profileId as string ?? null
    : null;

  return {
    userId: user.id,
    email: user.email,
    notificationEmail: user.notificationEmail,
    notifyEmails: user.notifyEmails,
    syncCronEnabled: user.syncCronEnabled,
    stremioConnected: !!stremioConn,
    nuvioConnected: !!nuvioConn,
    lastSyncAt,
    nuvioProfileId,
  };
}
