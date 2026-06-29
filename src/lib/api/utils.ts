import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "@/lib/auth/session";
import { getDb, type DrizzleDb } from "@/lib/db";

export function getEnv(): CloudflareEnv {
  return getCloudflareContext().env;
}

export function getDbFromContext(): DrizzleDb {
  return getDb(getEnv());
}

export async function verifySession(request: Request): Promise<SessionPayload | null> {
  const env = getEnv();
  return getSession(request, env.SESSION_SECRET);
}

export async function requireSession(
  request: Request,
): Promise<{ session: SessionPayload } | { error: NextResponse }> {
  const session = await verifySession(request);
  if (!session) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session };
}