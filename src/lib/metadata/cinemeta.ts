import { z } from "zod";

const CINEMETA_BASE = "https://v3-cinemeta.strem.io";

export interface EpisodeVideo {
  id: string;
  season: number;
  episode: number;
  title?: string;
  released?: string;
}

export interface CinemetaMeta {
  id: string;
  type: "movie" | "series";
  name: string;
  poster?: string;
  year?: string;
  videos?: EpisodeVideo[];
  status?: string;
}

const metaSchema: z.ZodType<CinemetaMeta> = z.object({
  id: z.string(),
  type: z.enum(["movie", "series"]),
  name: z.string(),
  poster: z.string().optional(),
  year: z.string().optional(),
  videos: z.array(z.object({
    id: z.string(),
    season: z.number(),
    episode: z.number(),
    title: z.string().optional(),
    released: z.string().optional(),
  })).optional(),
  status: z.string().optional(),
});

export async function bulkVideoIds(
  imdbIds: string[],
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();

  for (let i = 0; i < imdbIds.length; i += 100) {
    const batch = imdbIds.slice(i, i + 100);
    const idsParam = batch.join(",");

    const res = await fetch(
      `${CINEMETA_BASE}/catalog/series/video-ids/imdbIds=${idsParam}.json`,
    );

    if (!res.ok) {
      console.error(`Cinemeta bulk video IDs HTTP ${res.status}`);
      continue;
    }

    const json = (await res.json()) as {
      metas?: { id: string; videos?: { id: string }[] }[];
    };

    for (const meta of json.metas ?? []) {
      if (meta.videos) {
        result.set(meta.id, meta.videos.map((v) => v.id));
      }
    }
  }

  return result;
}

export async function getMeta(
  imdbId: string,
  type: "movie" | "series" = "series",
): Promise<CinemetaMeta | null> {
  const res = await fetch(`${CINEMETA_BASE}/meta/${type}/${imdbId}.json`);
  if (!res.ok) return null;

  const json = (await res.json()) as { meta?: unknown };
  const parsed = metaSchema.safeParse(json.meta);
  if (!parsed.success) return null;

  return parsed.data;
}


export function posterUrl(imdbId: string): string {
  return `https://images.metahub.space/poster/medium/${imdbId}/img`;
}
