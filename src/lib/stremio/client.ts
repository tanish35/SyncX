import { z } from "zod";

const STREMIO_API = "https://api.strem.io/api";

const stremioErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.number().optional(),
  }),
});

function isStremioError(body: unknown): body is z.infer<typeof stremioErrorSchema> {
  return stremioErrorSchema.safeParse(body).success;
}

async function stremioPost<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${STREMIO_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Stremio ${method} HTTP ${res.status}: ${await res.text()}`);
  }

  const json: unknown = await res.json();

  if (isStremioError(json)) {
    throw new Error(`Stremio ${method}: ${json.error.message} (code ${json.error.code ?? "n/a"})`);
  }

  const envelope = json as { result?: unknown };
  if (envelope.result === undefined) {
    throw new Error(`Stremio ${method}: missing result in response`);
  }

  return envelope.result as T;
}

export interface StremioUser {
  _id: string;
  email: string;
  fullName?: string;
}

export interface StremioLoginResult {
  authKey: string;
  user: StremioUser;
}

export interface StremioLibraryItem {
  _id: string;
  name?: string;
  type: "movie" | "series";
  poster?: string;
  posterShape?: string;
  removed?: boolean;
  temp?: boolean;
  _mtime?: string;
  _ctime?: string;
  state: {
    lastWatched?: string | null;
    timeWatched?: number;
    timeOffset?: number;
    overallTimeWatched?: number;
    timesWatched?: number;
    flaggedWatched?: number;
    duration?: number;
    video_id?: string;
    watched?: string;
    noNotif?: boolean;
  };
}

export async function login(
  email: string,
  password: string,
): Promise<StremioLoginResult> {
  return stremioPost<StremioLoginResult>("login", { email, password });
}

export async function getUser(authKey: string): Promise<StremioUser> {
  return stremioPost<StremioUser>("getUser", { authKey });
}
