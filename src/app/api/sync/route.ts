import { NextRequest, NextResponse } from "next/server";
import { getEnv, requireSession } from "@/lib/api/utils";
import { syncStep, type SyncCursor } from "@/lib/sync/tick";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if ("error" in auth) return auth.error;
  const { session } = auth;

  try {
    const body = (await request.json().catch(() => ({}))) as { cursor?: SyncCursor; mode?: "sync" | "pull" };
    const env = getEnv();
    const { cursor, done, progress } = await syncStep(session.userId, env, body.cursor ?? null, body.mode ?? "sync");

    return NextResponse.json({ success: true, done, progress, cursor, stats: cursor.stats });
  } catch (err) {
    console.error("Sync error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 },
    );
  }
}
