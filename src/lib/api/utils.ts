import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { getDb, type DrizzleDb } from "@/lib/db";
import { getOrCreateClerkUser } from "@/lib/auth/clerk-user";

export interface SessionPayload {
  userId: string;
}

export function getEnv(): CloudflareEnv {
  return getCloudflareContext().env;
}

export function getDbFromContext(): DrizzleDb {
  return getDb(getEnv());
}

export async function verifySession(_request: Request): Promise<SessionPayload | null> {
  const env = getEnv();
  const user = await getOrCreateClerkUser(env);
  if (!user?.approved) return null;
  return { userId: user.id };
}

export async function requireSession(
  request: Request,
): Promise<{ session: SessionPayload } | { error: NextResponse }> {
  const session = await verifySession(request);
  if (!session) {
    return {
      error: NextResponse.json({ error: "Unauthorized or pending approval" }, { status: 403 }),
    };
  }
  return { session };
}
