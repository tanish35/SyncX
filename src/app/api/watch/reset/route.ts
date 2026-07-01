import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getEnv, requireSession } from "@/lib/api/utils";
import { getDb } from "@/lib/db";
import { connections, notifications, pushLog, watchState } from "@/lib/db/schema";

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if ("error" in auth) return auth.error;
  const { session } = auth;

  try {
    const db = getDb(getEnv());
    const now = new Date();

    await db.delete(notifications).where(eq(notifications.userId, session.userId));
    await db.delete(pushLog).where(eq(pushLog.userId, session.userId));
    await db.delete(watchState).where(eq(watchState.userId, session.userId));
    await db.update(connections)
      .set({ cursors: null, lastSyncAt: null, lastError: null, updatedAt: now })
      .where(eq(connections.userId, session.userId));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Reset watch data error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Reset failed" }, { status: 500 });
  }
}
