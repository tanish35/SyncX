import { redirect } from "next/navigation";
import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft, Database, Film, MonitorPlay } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getServerUser } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { media, watchState } from "@/lib/db/schema";
import { getMeta, posterUrl } from "@/lib/metadata/cinemeta";
import { formatIstDateTime } from "@/lib/time";
import LazyWatchList from "./lazy-watch-list";

export const dynamic = "force-dynamic";

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function episodeLabel(type: string, season: number | null, episode: number | null) {
  if (season === null || episode === null) return type === "series" ? "Series" : "Movie";
  return `S${season} E${episode}`;
}

function progressPct(positionMs: number, durationMs: number) {
  return durationMs > 0 ? Math.min(100, Math.round((positionMs / durationMs) * 100)) : 0;
}

function progressLabel(state: typeof watchState.$inferSelect) {
  if (state.durationMs > 0) return `${formatTime(state.positionMs)} / ${formatTime(state.durationMs)}`;
  return state.watched ? "Watched" : "Runtime unknown";
}

export default async function CurrentlyWatchingPage() {
  const user = await getServerUser();
  if (!user) redirect("/");

  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env);
  const rows = await db
    .select({
      state: watchState,
      item: media,
    })
    .from(watchState)
    .innerJoin(media, eq(watchState.mediaId, media.id))
    .where(eq(watchState.userId, user.userId))
    .orderBy(desc(watchState.lastWatchedAt), desc(watchState.updatedAt))
    .all();

  const metaCache = new Map<string, Awaited<ReturnType<typeof getMeta>>>();
  const savedMedia = new Set<string>();
  for (const row of rows) {
    const imdbId = row.item.imdbId;
    if (!imdbId?.startsWith("tt")) continue;
    if (row.item.posterUrl) continue;
    const type = row.item.type === "movie" ? "movie" : "series";
    const cacheKey = `${type}:${imdbId}`;
    const meta = metaCache.has(cacheKey)
      ? metaCache.get(cacheKey)
      : await getMeta(imdbId, type).catch(() => null);
    metaCache.set(cacheKey, meta ?? null);
    row.item.title = meta?.name ?? row.item.title ?? imdbId;
    row.item.year = meta?.year ? parseInt(meta.year, 10) || row.item.year : row.item.year;
    row.item.posterUrl = meta?.poster ?? row.item.posterUrl ?? posterUrl(imdbId);
    row.item.status = meta?.status ?? row.item.status;
    if (savedMedia.has(row.item.id)) continue;
    savedMedia.add(row.item.id);
    await db.update(media).set({
      title: row.item.title,
      year: row.item.year,
      posterUrl: row.item.posterUrl,
      status: row.item.status,
      updatedAt: new Date(),
    }).where(eq(media.id, row.item.id));
  }

  const active = rows.filter(({ state }) => {
    if (state.watched || state.positionMs <= 0 || state.durationMs <= 0) return false;
    return state.positionMs < state.durationMs;
  });
  const now = active[0] ?? rows[0];
  const seriesMap = new Map<string, { item: typeof media.$inferSelect; episodes: typeof rows }>();
  const movies = rows.filter(({ item }) => item.type === "movie");

  for (const row of rows) {
    if (row.item.type !== "series") continue;
    const group = seriesMap.get(row.item.id) ?? { item: row.item, episodes: [] };
    group.episodes.push(row);
    seriesMap.set(row.item.id, group);
  }

  const series = [...seriesMap.values()].map((group) => {
    const latest = group.episodes[0];
    return {
      ...group,
      episodes: [...group.episodes].sort((a, b) => (
        (a.state.season ?? 0) - (b.state.season ?? 0)
        || (a.state.episode ?? 0) - (b.state.episode ?? 0)
      )),
      latest,
    };
  });
  const serializeRow = ({ state, item }: typeof rows[number]) => ({
    state: {
      id: state.id,
      season: state.season,
      episode: state.episode,
      watched: state.watched,
      positionMs: state.positionMs,
      durationMs: state.durationMs,
      lastWatchedAt: state.lastWatchedAt ? formatIstDateTime(state.lastWatchedAt) : null,
    },
    item: {
      id: item.id,
      title: item.title,
      imdbId: item.imdbId,
      type: item.type,
      posterUrl: item.posterUrl,
    },
  });
  const lazySeries = series.map(({ item, episodes, latest }) => ({
    item: { id: item.id, title: item.title, imdbId: item.imdbId, type: item.type, posterUrl: item.posterUrl },
    episodes: episodes.map(serializeRow),
    latest: latest ? serializeRow(latest) : undefined,
  }));
  const lazyMovies = movies.map(serializeRow);

  return (
    <div className="container max-w-5xl py-10 animate-fade-in">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-primary">
            <MonitorPlay className="h-4 w-4" />
            <span className="font-medium">Currently Watching</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Your watch position</h1>
          <p className="text-muted-foreground">Latest synced row from your watch-state database.</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </Button>
      </div>

      {now ? (
        <Card className="mb-6 overflow-hidden border-primary/30 bg-primary/5">
          <CardContent className="grid gap-5 p-5 sm:grid-cols-[7rem_1fr]">
            <div className="flex aspect-[2/3] items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
              {now.item.posterUrl ? (
                
                <img src={now.item.posterUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Film className="h-9 w-9 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 self-center">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge>{episodeLabel(now.item.type, now.state.season, now.state.episode)}</Badge>
                <Badge variant={now.state.watched ? "success" : "secondary"}>
                  {now.state.watched ? "Watched" : "In progress"}
                </Badge>
              </div>
              <h2 className="truncate text-2xl font-bold tracking-tight">
                {now.item.title ?? now.item.imdbId ?? "Untitled"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {progressLabel(now.state)}
                {now.state.lastWatchedAt ? ` · ${formatIstDateTime(now.state.lastWatchedAt)}` : ""}
              </p>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${progressPct(now.state.positionMs, now.state.durationMs)}%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <Database className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No watch-state rows yet</p>
            <p className="text-sm text-muted-foreground">Run a sync or import to populate this page.</p>
          </CardContent>
        </Card>
      )}

      <LazyWatchList series={lazySeries} movies={lazyMovies} currentMediaId={now?.item.id ?? null} />
    </div>
  );
}
