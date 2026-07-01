import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getEnv, requireSession } from "@/lib/api/utils";
import { getDb } from "@/lib/db";
import { media, watchState } from "@/lib/db/schema";

function mapStatus(status: string | null | undefined) {
  switch (status) {
    case "Running":
      return "continuing";
    case "Ended":
    case "Canceled":
      return "ended";
    default:
      return status?.toLowerCase() ?? null;
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if ("error" in auth) return auth.error;
  const { session } = auth;

  try {
    const body = (await request.json()) as {
      tvmazeId?: number;
      imdbId?: string | null;
      title?: string;
      year?: number | null;
      posterUrl?: string | null;
      status?: string | null;
    };
    if (!body.tvmazeId || !body.title) {
      return NextResponse.json({ error: "tvmazeId and title are required" }, { status: 400 });
    }

    const db = getDb(getEnv());
    const now = new Date();
    const existing = body.imdbId
      ? await db.select().from(media).where(eq(media.imdbId, body.imdbId)).get()
      : await db.select().from(media).where(eq(media.tvmazeId, body.tvmazeId)).get();

    const mediaId = existing?.id ?? crypto.randomUUID();
    if (existing) {
      await db.update(media).set({
        tvmazeId: body.tvmazeId,
        title: body.title,
        year: body.year ?? existing.year,
        posterUrl: body.posterUrl ?? existing.posterUrl,
        status: mapStatus(body.status) ?? existing.status,
        noNotif: false,
        updatedAt: now,
      }).where(eq(media.id, existing.id));
    } else {
      await db.insert(media).values({
        id: mediaId,
        imdbId: body.imdbId ?? null,
        tvmazeId: body.tvmazeId,
        type: "series",
        title: body.title,
        year: body.year ?? null,
        posterUrl: body.posterUrl ?? null,
        status: mapStatus(body.status),
        noNotif: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    const existingState = await db.select().from(watchState).where(and(
      eq(watchState.userId, session.userId),
      eq(watchState.mediaId, mediaId),
      isNull(watchState.season),
      isNull(watchState.episode),
    )).get();

    if (existingState) {
      await db.update(watchState).set({
        watched: true,
        timesWatched: Math.max(existingState.timesWatched, 1),
        lastWatchedAt: existingState.lastWatchedAt ?? now,
        updatedAt: now,
      }).where(eq(watchState.id, existingState.id));
    } else {
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

    return NextResponse.json({ success: true, mediaId });
  } catch (err) {
    console.error("Track series error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Track failed" }, { status: 500 });
  }
}
