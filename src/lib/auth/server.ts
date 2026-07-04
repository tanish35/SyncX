import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, connections } from "@/lib/db/schema";
import { getOrCreateClerkUser } from "./clerk-user";

export async function getServerSession(): Promise<{ userId: string } | null> {
  const { env } = await getCloudflareContext({ async: true });
  const user = await getOrCreateClerkUser(env);
  if (!user?.approved) return null;
  return { userId: user.id };
}

export interface ServerUser {
  userId: string;
  email: string | null;
  notificationEmail: string | null;
  notifyEmails: boolean;
  syncCronEnabled: boolean;
  syncCronMode: "sync" | "pull";
  role: string;
  approved: boolean;
  stremioConnected: boolean;
  nuvioConnected: boolean;
  lastSyncAt: Date | null;
  nuvioProfileId: string | null;
}

export async function getServerUser(): Promise<ServerUser | null> {
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env);
  const sessionUser = await getOrCreateClerkUser(env);
  if (!sessionUser?.approved) return null;

  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .get();

  if (!user) return null;

  const conns = await db
    .select()
    .from(connections)
    .where(eq(connections.userId, sessionUser.id))
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
    syncCronMode: user.syncCronMode === "pull" ? "pull" : "sync",
    role: user.role,
    approved: user.approved,
    stremioConnected: !!stremioConn,
    nuvioConnected: !!nuvioConn,
    lastSyncAt,
    nuvioProfileId,
  };
}
