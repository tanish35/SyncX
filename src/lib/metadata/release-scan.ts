//







import { eq, and } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from "@/lib/db/index";
import {
  media,
  watchState,
  notifications,
  videoIndex,
} from "@/lib/db/schema";
import { lookupShowByImdb, getShowWithEpisodes } from "./tvmaze";
import { getShowDetails } from "./tmdb";
import { getMeta } from "./cinemeta";
import { getEnv } from "@/lib/auth/env";



export interface EpisodeInfo {
  season: number;
  episode: number;
  title: string;
  airDate: Date | null;
}

interface ScanResult {
  scanned: number;
  resolved: number;
  notificationsCreated: number;
  errors: string[];
}



export async function runReleaseScan(env: CloudflareEnv): Promise<ScanResult> {
  const config = getEnv(env);
  const db = getDb(env);
  const result: ScanResult = {
    scanned: 0,
    resolved: 0,
    notificationsCreated: 0,
    errors: [],
  };

  
  const shows = await db
    .select()
    .from(media)
    .where(and(eq(media.type, "series"), eq(media.noNotif, false)));

  result.scanned = shows.length;
  console.log(`[release-scan] Scanning ${shows.length} active series`);

  for (const show of shows) {
    try {
      let tvmazeId = show.tvmazeId;

      
      if (!tvmazeId && show.imdbId) {
        tvmazeId = await resolveTvmazeId(show.imdbId);
        if (tvmazeId) {
          await db
            .update(media)
            .set({ tvmazeId, updatedAt: new Date() })
            .where(eq(media.id, show.id));
        }
      }

      
      const { nextEp, status: showStatus } =
        await fetchEpisodeInfo(show, tvmazeId, config.TMDB_ACCESS_TOKEN);

      
      if (showStatus && showStatus !== show.status) {
        await db
          .update(media)
          .set({ status: showStatus, updatedAt: new Date() })
          .where(eq(media.id, show.id));
      }

      
      if (show.imdbId) {
        await refreshVideoIndex(db, show.id, show.imdbId);
      }

      
      if (nextEp?.airDate) {
        const count = await createNotifications(db, show.id, nextEp);
        result.notificationsCreated += count;
        result.resolved++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[release-scan] Error for ${show.id}: ${msg}`);
      result.errors.push(`${show.imdbId ?? show.id}: ${msg}`);
    }
  }

  console.log(
    `[release-scan] Done: ${result.resolved} resolved, ` +
      `${result.notificationsCreated} notifications, ${result.errors.length} errors`,
  );
  return result;
}



export async function fetchEpisodeInfo(
  show: { id: string; imdbId: string | null; tmdbId: string | null; status: string | null },
  tvmazeId: number | null | undefined,
  tmdbAccessToken: string,
): Promise<{ nextEp: EpisodeInfo | null; prevEp: EpisodeInfo | null; status: string | null }> {
  
  if (tvmazeId) {
    const tvmazeShow = await getShowWithEpisodes(tvmazeId);
    if (tvmazeShow) {
      const nextEp = tvmazeShow._embedded?.nextepisode
        ? parseTvmazeEp(tvmazeShow._embedded.nextepisode) : null;
      const prevEp = tvmazeShow._embedded?.previousepisode
        ? parseTvmazeEp(tvmazeShow._embedded.previousepisode) : null;
      if (nextEp || prevEp) {
        return { nextEp, prevEp, status: mapStatus(tvmazeShow.status) };
      }
    }
  }

  
  if (show.tmdbId && tmdbAccessToken) {
    const tmdb = await getShowDetails(parseInt(show.tmdbId, 10), tmdbAccessToken);
    if (tmdb) {
      const nextEp = tmdb.next_episode_to_air
        ? parseTmdbEp(tmdb.next_episode_to_air) : null;
      const prevEp = tmdb.last_episode_to_air
        ? parseTmdbEp(tmdb.last_episode_to_air) : null;
      if (nextEp || prevEp) {
        return { nextEp, prevEp, status: mapStatus(tmdb.status) };
      }
    }
  }

  
  if (show.imdbId) {
    const meta = await getMeta(show.imdbId, "series");
    if (meta?.videos?.length) {
      const sorted = [...meta.videos].sort((a, b) =>
        a.season !== b.season ? a.season - b.season : a.episode - b.episode,
      );
      const now = new Date();
      const upcoming = sorted.find((v) => v.released && new Date(v.released) > now);
      const released = sorted.filter((v) => v.released && new Date(v.released) <= now);
      const nextEp: EpisodeInfo | null = upcoming
        ? { season: upcoming.season, episode: upcoming.episode, title: upcoming.title ?? "TBA", airDate: new Date(upcoming.released!) }
        : null;
      const last = released[released.length - 1];
      const prevEp: EpisodeInfo | null = last
        ? { season: last.season, episode: last.episode, title: last.title ?? "Unknown", airDate: new Date(last.released!) }
        : null;
      return { nextEp, prevEp, status: meta.status ?? null };
    }
  }

  return { nextEp: null, prevEp: null, status: null };
}



function parseTvmazeEp(ep: {
  season: number; number: number; name: string; airstamp: string; airdate: string;
}): EpisodeInfo {
  return {
    season: ep.season,
    episode: ep.number,
    title: ep.name,
    airDate: ep.airstamp ? new Date(ep.airstamp) : ep.airdate ? new Date(ep.airdate) : null,
  };
}

function parseTmdbEp(ep: {
  season_number: number; episode_number: number; name: string; air_date: string | null;
}): EpisodeInfo {
  return {
    season: ep.season_number,
    episode: ep.episode_number,
    title: ep.name,
    airDate: ep.air_date ? new Date(ep.air_date) : null,
  };
}

function mapStatus(status: string): string {
  switch (status) {
    case "Running":
    case "Returning Series":
      return "continuing";
    case "Ended":
    case "Canceled":
      return "ended";
    default:
      return status.toLowerCase();
  }
}



async function resolveTvmazeId(imdbId: string): Promise<number | null> {
  const show = await lookupShowByImdb(imdbId);
  return show?.id ?? null;
}



async function refreshVideoIndex(
  db: ReturnType<typeof getDb>,
  mediaId: string,
  imdbId: string,
): Promise<void> {
  const meta = await getMeta(imdbId, "series");
  if (!meta?.videos?.length) return;

  const rows = meta.videos.map((v) => ({
    id: `${mediaId}:${v.id}`,
    mediaId,
    videoId: v.id,
    season: v.season,
    episode: v.episode,
    title: v.title ?? null,
    releasedAt: v.released ? new Date(v.released) : null,
  }));

  const stmts = rows.map((row) =>
    db.insert(videoIndex).values(row).onConflictDoUpdate({
      target: [videoIndex.mediaId, videoIndex.videoId],
      set: { season: row.season, episode: row.episode, title: row.title, releasedAt: row.releasedAt },
    }),
  );

  for (let i = 0; i < stmts.length; i += 100) {
    const chunk = stmts.slice(i, i + 100) as unknown as [
      BatchItem<"sqlite">,
      ...BatchItem<"sqlite">[],
    ];
    await db.batch(chunk);
  }
}



async function createNotifications(
  db: ReturnType<typeof getDb>,
  mediaId: string,
  episode: EpisodeInfo,
): Promise<number> {
  if (!episode.airDate) return 0;

  const watchingUsers = await db
    .selectDistinct({ userId: watchState.userId })
    .from(watchState)
    .where(eq(watchState.mediaId, mediaId));

  if (watchingUsers.length === 0) return 0;

  
  const now = new Date();
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (episode.airDate < cutoff) return 0;

  const rows = watchingUsers.map((u) => ({
    id: crypto.randomUUID(),
    userId: u.userId,
    mediaId,
    season: episode.season,
    episode: episode.episode,
    title: episode.title,
    airDate: episode.airDate,
    createdAt: now,
  }));

  const stmts = rows.map((row) =>
    db.insert(notifications).values(row).onConflictDoNothing({
      target: [
        notifications.userId,
        notifications.mediaId,
        notifications.season,
        notifications.episode,
      ],
    }),
  );

  for (let i = 0; i < stmts.length; i += 100) {
    const chunk = stmts.slice(i, i + 100) as unknown as [
      BatchItem<"sqlite">,
      ...BatchItem<"sqlite">[],
    ];
    await db.batch(chunk);
  }

  return rows.length;
}
