import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getEnv, requireSession } from "@/lib/api/utils";
import { getDb } from "@/lib/db";
import { media, watchState } from "@/lib/db/schema";

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if ("error" in auth) return auth.error;
  const { session } = auth;

  try {
    const { mediaId } = (await request.json()) as { mediaId?: string };
    if (!mediaId) return NextResponse.json({ error: "mediaId is required" }, { status: 400 });

    const db = getDb(getEnv());
    const now = new Date();
    const target = await db.select().from(media).where(eq(media.id, mediaId)).get();
    if (!target) return NextResponse.json({ error: "Media not found" }, { status: 404 });

    const rows = await db
      .select()
      .from(watchState)
      .where(and(eq(watchState.userId, session.userId), eq(watchState.mediaId, mediaId)))
      .all();

    for (const row of rows) {
      await db
        .update(watchState)
        .set({
          watched: true,
          positionMs: row.durationMs > 0 ? row.durationMs : row.positionMs,
          timesWatched: Math.max(row.timesWatched, 1),
          lastWatchedAt: now,
          updatedAt: now,
        })
        .where(eq(watchState.id, row.id));
    }

    if (rows.length === 0) {
      await db.insert(watchState).values({
        id: crypto.randomUUID(),
        userId: session.userId,
        mediaId,
        season: null,
        episode: null,
        watched: true,
        positionMs: 0,
        durationMs: 0,
        lastWatchedAt: now,
        timesWatched: 1,
        createdAt: now,
        updatedAt: now,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Mark watched error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Mark watched failed" }, { status: 500 });
  }
}
