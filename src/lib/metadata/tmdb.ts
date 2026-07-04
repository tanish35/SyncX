const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export interface TMDBEpisode {
  id: number;
  name: string;
  season_number: number;
  episode_number: number;
  air_date: string | null;
  overview: string;
  still_path: string | null;
}

export interface TMDBSeason {
  id: number;
  season_number: number;
  name: string;
  air_date: string | null;
  episode_count: number;
  episodes?: TMDBEpisode[];
}

export interface TMDBShowDetails {
  id: number;
  name: string;
  original_name: string;
  status: string;
  first_air_date: string | null;
  last_air_date: string | null;
  number_of_seasons: number;
  number_of_episodes: number;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  next_episode_to_air: TMDBEpisode | null;
  last_episode_to_air: TMDBEpisode | null;
  seasons: TMDBSeason[];
  networks: { name: string }[];
  external_ids?: TMDBExternalIds;
}

export interface TMDBExternalIds {
  imdb_id: string | null;
  tvdb_id: number | null;
  freebase_mid: string | null;
  freebase_id: string | null;
  tvrage_id: number | null;
  wikidata_id: string | null;
}

export interface TMDBFindResult {
  tv_results: TMDBShowDetails[];
  movie_results: { id: number; title: string; release_date: string | null }[];
}

function authHeaders(accessToken: string): HeadersInit {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

async function tmdbFetch<T>(
  path: string,
  accessToken: string,
  cacheTtl = 3600,
): Promise<T | null> {
  const url = `${TMDB_BASE}${path}`;
  const res = await fetch(url, {
    headers: authHeaders(accessToken),
    cf: { cacheTtl, cacheEverything: true },
  } as RequestInit);

  if (!res.ok) {
    console.error(`[tmdb] ${path} HTTP ${res.status}`);
    return null;
  }

  return (await res.json()) as T;
}

export async function findByImdb(
  imdbId: string,
  accessToken: string,
): Promise<TMDBFindResult | null> {
  return tmdbFetch<TMDBFindResult>(
    `/find/${encodeURIComponent(imdbId)}?external_source=imdb_id`,
    accessToken,
  );
}

export async function getShowDetails(
  tmdbId: number,
  accessToken: string,
): Promise<TMDBShowDetails | null> {
  return tmdbFetch<TMDBShowDetails>(
    `/tv/${tmdbId}`,
    accessToken,
  );
}

export async function getExternalIds(
  tmdbId: number,
  accessToken: string,
): Promise<TMDBExternalIds | null> {
  return tmdbFetch<TMDBExternalIds>(
    `/tv/${tmdbId}/external_ids`,
    accessToken,
  );
}

export function posterUrl(
  posterPath: string | null,
  size: "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "original" = "w342",
): string | null {
  if (!posterPath) return null;
  return `${TMDB_IMAGE_BASE}/${size}${posterPath}`;
}
