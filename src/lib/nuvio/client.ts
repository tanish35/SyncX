const NUVIO_BASE = "https://api.nuvio.tv";
const NUVIO_AUTH_BASE = `${NUVIO_BASE}/auth/v1`;
const NUVIO_REST_BASE = `${NUVIO_BASE}/rest/v1`;
const NUVIO_APIKEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgxNTIxMzQ2LCJleHAiOjE5MzkyMDEzNDZ9.tmQaj682pwzehpqlgCDMnySOqiUvpgRbrE43T4VJpDI";

export interface NuvioTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface NuvioProgressEntry {
  content_id: string;
  content_type: string;
  video_id: string;
  season?: number;
  episode?: number;
  position: number;
  duration: number;
  last_watched: number;
}

export interface NuvioWatchedItem {
  content_id: string;
  content_type: string;
  title?: string;
  season?: number;
  episode?: number;
  watched_at: number;
}

export interface NuvioProgressDelta {
  event_id: number;
  event_type: "upsert" | "delete";
  content_id: string;
  content_type: string;
  video_id: string;
  season?: number;
  episode?: number;
  position?: number;
  duration?: number;
  last_watched?: number;
}

export interface NuvioWatchedDelta {
  event_id: number;
  event_type: "upsert" | "delete";
  content_id: string;
  content_type: string;
  title?: string;
  season?: number;
  episode?: number;
  watched_at?: number;
}

export interface NuvioProfile {
  profile_id: number;
  profile_name: string;
}

function nuvioHeaders(accessToken?: string): Record<string, string> {
  const h: Record<string, string> = {
    apikey: NUVIO_APIKEY,
    authorization: `Bearer ${accessToken ?? NUVIO_APIKEY}`,
    "content-type": "application/json",
    "x-client-info": "SyncX",
  };
  return h;
}

async function nuvioFetch(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, init);
    } catch (err) {
      lastErr = err;
      const code = (err as { cause?: { code?: string } })?.cause?.code;
      const transient =
        err instanceof TypeError || 
        code === "UND_ERR_CONNECT_TIMEOUT" ||
        code === "ECONNRESET" ||
        code === "ETIMEDOUT" ||
        code === "EAI_AGAIN";
      if (!transient || i === attempts - 1) throw err;
      console.warn(`[nuvio] fetch ${url} attempt ${i + 1}/${attempts} failed (${code ?? "network"}), retrying`);
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr;
}

async function nuvioRpc<T>(
  functionName: string,
  body: Record<string, unknown>,
  accessToken: string,
): Promise<T> {
  const res = await nuvioFetch(`${NUVIO_REST_BASE}/rpc/${functionName}`, {
    method: "POST",
    headers: nuvioHeaders(accessToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Nuvio ${functionName} HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}



export async function passwordLogin(email: string, password: string): Promise<NuvioTokens> {
  const res = await nuvioFetch(`${NUVIO_AUTH_BASE}/token?grant_type=password`, {
    method: "POST",
    headers: nuvioHeaders(),
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Nuvio login HTTP ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
  return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresIn: json.expires_in };
}

export async function refreshToken(refreshTk: string): Promise<NuvioTokens> {
  const res = await nuvioFetch(`${NUVIO_AUTH_BASE}/token?grant_type=refresh_token`, {
    method: "POST",
    headers: nuvioHeaders(),
    body: JSON.stringify({ refresh_token: refreshTk }),
  });
  if (!res.ok) throw new Error(`Nuvio refresh HTTP ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
  return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresIn: json.expires_in };
}



export async function pullWatchProgress(accessToken: string, profileId: number, since?: number, limit?: number): Promise<NuvioProgressEntry[]> {
  return nuvioRpc("sync_pull_watch_progress", { p_profile_id: profileId, p_since_last_watched: since, p_limit: limit }, accessToken);
}

export async function getProgressDeltaCursor(accessToken: string, profileId: number): Promise<number> {
  const r = await nuvioRpc<{ cursor: number } | number>("sync_get_watch_progress_delta_cursor", { p_profile_id: profileId }, accessToken);
  return typeof r === "number" ? r : r.cursor;
}

export async function pullProgressDelta(accessToken: string, profileId: number, sinceEventId: number, limit = 1000): Promise<NuvioProgressDelta[]> {
  return nuvioRpc("sync_pull_watch_progress_delta", { p_profile_id: profileId, p_since_event_id: sinceEventId, p_limit: limit }, accessToken);
}

export async function pushWatchProgress(accessToken: string, profileId: number, entries: NuvioProgressEntry[]): Promise<void> {
  await nuvioRpc("sync_push_watch_progress", { p_profile_id: profileId, p_entries: entries }, accessToken);
}



export async function pullWatchedItems(accessToken: string, profileId: number, limit?: number, offset?: number): Promise<NuvioWatchedItem[]> {
  return nuvioRpc("sync_pull_watched_items", { p_profile_id: profileId, p_limit: limit, p_offset: offset }, accessToken);
}

export async function getWatchedDeltaCursor(accessToken: string, profileId: number): Promise<number> {
  const r = await nuvioRpc<{ cursor: number } | number>("sync_get_watched_items_delta_cursor", { p_profile_id: profileId }, accessToken);
  return typeof r === "number" ? r : r.cursor;
}

export async function pullWatchedDelta(accessToken: string, profileId: number, sinceEventId: number, limit = 1000): Promise<NuvioWatchedDelta[]> {
  return nuvioRpc("sync_pull_watched_items_delta", { p_profile_id: profileId, p_since_event_id: sinceEventId, p_limit: limit }, accessToken);
}

export async function pushWatchedItems(accessToken: string, profileId: number, items: NuvioWatchedItem[]): Promise<void> {
  await nuvioRpc("sync_push_watched_items", { p_profile_id: profileId, p_items: items }, accessToken);
}

export async function getProfiles(accessToken: string): Promise<NuvioProfile[]> {
  try {
    const raw = await nuvioRpc<unknown>("get_sync_overview", {}, accessToken);
    console.log("[nuvio] get_sync_overview raw:", JSON.stringify(raw).slice(0, 500));

    
    if (Array.isArray(raw)) {
      return raw.filter((p: unknown): p is NuvioProfile =>
        typeof p === "object" && p !== null && "profile_id" in p
      );
    }

    
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const obj = raw as Record<string, unknown>;
      for (const key of ["profiles", "data", "items", "result"]) {
        const val = obj[key];
        if (Array.isArray(val)) {
          return val.filter((p: unknown): p is NuvioProfile =>
            typeof p === "object" && p !== null && "profile_id" in p
          );
        }
      }
    }

    
    console.warn("[nuvio] Could not extract profiles from get_sync_overview, using defaults");
    return Array.from({ length: 6 }, (_, i) => ({
      profile_id: i + 1,
      profile_name: `Profile ${i + 1}`,
    }));
  } catch (err) {
    console.warn("[nuvio] getProfiles failed, using defaults:", err);
    return Array.from({ length: 6 }, (_, i) => ({
      profile_id: i + 1,
      profile_name: `Profile ${i + 1}`,
    }));
  }
}
