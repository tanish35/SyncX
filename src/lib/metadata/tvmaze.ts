const TVMAZE_BASE = "https://api.tvmaze.com";

export interface TVMazeEpisode {
  id: number;
  name: string;
  season: number;
  number: number;
  airdate: string;
  airstamp: string;
  runtime: number | null;
  summary: string | null;
  image: { medium: string; original: string } | null;
}

export interface TVMazeShow {
  id: number;
  name: string;
  status: "Running" | "Ended" | "In Development" | string;
  premiered: string | null;
  ended: string | null;
  network: { name: string } | null;
  webChannel: { name: string } | null;
  externals: { imdb: string | null; thetvdb: number | null; tvrage: number | null };
  image: { medium: string; original: string } | null;
  _embedded?: {
    nextepisode?: TVMazeEpisode | null;
    previousepisode?: TVMazeEpisode | null;
  };
}

export interface TVMazeSearchResult {
  score: number;
  show: TVMazeShow & {
    summary: string | null;
    genres: string[];
  };
}

export async function lookupShowByImdb(
  imdbId: string,
): Promise<TVMazeShow | null> {
  const url = `${TVMAZE_BASE}/lookup/shows?imdb=${encodeURIComponent(imdbId)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cf: { cacheTtl: 3600, cacheEverything: true },
  } as RequestInit);

  if (res.status === 404) return null;
  if (!res.ok) {
    console.error(`[tvmaze] lookupShowByImdb(${imdbId}) HTTP ${res.status}`);
    return null;
  }

  return (await res.json()) as TVMazeShow;
}

export async function getShowWithEpisodes(
  tvmazeId: number,
): Promise<TVMazeShow | null> {
  const url = `${TVMAZE_BASE}/shows/${tvmazeId}?embed[]=nextepisode&embed[]=previousepisode`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cf: { cacheTtl: 1800, cacheEverything: true },
  } as RequestInit);

  if (res.status === 404) return null;
  if (!res.ok) {
    console.error(`[tvmaze] getShowWithEpisodes(${tvmazeId}) HTTP ${res.status}`);
    return null;
  }

  return (await res.json()) as TVMazeShow;
}

export async function searchShows(query: string): Promise<TVMazeSearchResult[]> {
  const url = `${TVMAZE_BASE}/search/shows?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cf: { cacheTtl: 3600, cacheEverything: true },
  } as RequestInit);

  if (!res.ok) {
    console.error(`[tvmaze] searchShows(${query}) HTTP ${res.status}`);
    return [];
  }

  return (await res.json()) as TVMazeSearchResult[];
}
