"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Film } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";

const SERIES_STEP = 8;
const MOVIE_STEP = 16;

type WatchRow = {
  state: {
    id: string;
    season: number | null;
    episode: number | null;
    watched: boolean;
    positionMs: number;
    durationMs: number;
    lastWatchedAt: string | null;
  };
  item: {
    id: string;
    title: string | null;
    imdbId: string | null;
    type: string;
    posterUrl: string | null;
  };
};

type SeriesGroup = {
  item: WatchRow["item"];
  episodes: WatchRow[];
  latest: WatchRow | undefined;
};

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

function progressLabel(state: WatchRow["state"]) {
  if (state.durationMs > 0) return `${formatTime(state.positionMs)} / ${formatTime(state.durationMs)}`;
  return state.watched ? "Watched" : "Runtime unknown";
}

function isComplete(state: WatchRow["state"]) {
  return state.watched && (state.durationMs <= 0 || state.positionMs >= state.durationMs);
}

function countLabel(count: number) {
  return `${count} ${count === 1 ? "episode" : "episodes"}`;
}

function useVisibleCount(total: number, step: number) {
  const [visible, setVisible] = useState(step);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || visible >= total) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible((count) => Math.min(total, count + step));
    }, { rootMargin: "320px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [step, total, visible]);

  return { visible, sentinelRef };
}

function LoadSentinel({ shown, total, refNode }: { shown: number; total: number; refNode: React.RefObject<HTMLDivElement | null> }) {
  if (shown >= total) return null;
  return <div ref={refNode} className="h-8 text-center text-xs text-muted-foreground">Loading more…</div>;
}

function MarkWatchedButton({ mediaId }: { mediaId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function markWatched(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await fetch("/api/watch/mark-watched", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Button onClick={markWatched} disabled={saving} variant="outline" size="sm">
      Mark watched
    </Button>
  );
}

function PosterThumb({ item }: { item: WatchRow["item"] }) {
  return (
    <div className="flex aspect-[2/3] w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
      {item.posterUrl ? (
        <img src={item.posterUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <Film className="h-5 w-5 text-muted-foreground" />
      )}
    </div>
  );
}

function SeriesSection({ series, currentMediaId }: { series: SeriesGroup[]; currentMediaId: string | null }) {
  const { visible, sentinelRef } = useVisibleCount(series.length, SERIES_STEP);
  const shown = Math.min(visible, series.length);

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">Series</h2>
        <Badge variant="secondary">{series.length}</Badge>
      </div>
      <div className="grid gap-3">
        {series.slice(0, shown).map(({ item, episodes, latest }) => (
          <Card key={item.id} className="overflow-hidden">
            <details open={currentMediaId === item.id}>
              <summary className="grid cursor-pointer list-none gap-4 p-4 marker:hidden sm:grid-cols-[3rem_1fr_auto] sm:items-center">
                <PosterThumb item={item} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="truncate text-base">{item.title ?? item.imdbId ?? "Untitled"}</CardTitle>
                    <Badge variant="outline">{countLabel(episodes.length)}</Badge>
                    {latest?.state.watched ? <Badge variant="success">Latest watched</Badge> : <Badge variant="secondary">In progress</Badge>}
                    {!episodes.every((ep) => isComplete(ep.state)) && <MarkWatchedButton mediaId={item.id} />}
                  </div>
                  {latest && (
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${progressPct(latest.state.positionMs, latest.state.durationMs)}%` }} />
                    </div>
                  )}
                </div>
                {latest && (
                  <div className="grid gap-1 text-sm text-muted-foreground sm:min-w-48 sm:text-right">
                    <span className="font-medium text-foreground">{episodeLabel(item.type, latest.state.season, latest.state.episode)}</span>
                    <span>{progressLabel(latest.state)}</span>
                  </div>
                )}
              </summary>
              <div className="border-t border-border/60">
                {episodes.map(({ state }) => (
                  <div key={state.id} className="grid gap-3 border-b border-border/40 p-4 last:border-b-0 sm:grid-cols-[8rem_1fr_auto] sm:items-center">
                    <Badge variant="outline" className="w-fit">{episodeLabel(item.type, state.season, state.episode)}</Badge>
                    <div className="min-w-0">
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${progressPct(state.positionMs, state.durationMs)}%` }} />
                      </div>
                    </div>
                    <div className="grid gap-1 text-sm text-muted-foreground sm:min-w-48 sm:text-right">
                      <span className="font-medium text-foreground">{progressLabel(state)}</span>
                      <span className="flex items-center gap-1 sm:justify-end">
                        <Clock3 className="h-3.5 w-3.5" />
                        {state.lastWatchedAt ?? "Never watched"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </Card>
        ))}
        {!series.length && <p className="text-sm text-muted-foreground">No series rows yet.</p>}
        <LoadSentinel shown={shown} total={series.length} refNode={sentinelRef} />
      </div>
    </section>
  );
}

function MoviesSection({ movies }: { movies: WatchRow[] }) {
  const { visible, sentinelRef } = useVisibleCount(movies.length, MOVIE_STEP);
  const shown = Math.min(visible, movies.length);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">Movies</h2>
        <Badge variant="secondary">{movies.length}</Badge>
      </div>
      <div className="grid gap-3">
        {movies.slice(0, shown).map(({ state, item }) => (
          <Card key={state.id}>
            <CardContent className="grid gap-4 p-4 sm:grid-cols-[3rem_1fr_auto] sm:items-center">
              <PosterThumb item={item} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="truncate text-base">{item.title ?? item.imdbId ?? "Untitled"}</CardTitle>
                  {state.watched && <Badge variant="success">Watched</Badge>}
                  {!isComplete(state) && <MarkWatchedButton mediaId={item.id} />}
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${progressPct(state.positionMs, state.durationMs)}%` }} />
                </div>
              </div>
              <div className="grid gap-1 text-sm text-muted-foreground sm:min-w-48 sm:text-right">
                <span className="font-medium text-foreground">{progressLabel(state)}</span>
                <span className="flex items-center gap-1 sm:justify-end">
                  <Clock3 className="h-3.5 w-3.5" />
                  {state.lastWatchedAt ?? "Never watched"}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
        {!movies.length && <p className="text-sm text-muted-foreground">No movie rows yet.</p>}
        <LoadSentinel shown={shown} total={movies.length} refNode={sentinelRef} />
      </div>
    </section>
  );
}

export default function LazyWatchList({
  series,
  movies,
  currentMediaId,
}: {
  series: SeriesGroup[];
  movies: WatchRow[];
  currentMediaId: string | null;
}) {
  return (
    <>
      <SeriesSection series={series} currentMediaId={currentMediaId} />
      <MoviesSection movies={movies} />
    </>
  );
}
