import { z } from "zod";
import type { StremioLibraryItem } from "./client";

const STREMIO_API = "https:

function assertNotError(json: unknown, method: string): void {
  const parsed = z
    .object({ error: z.object({ message: z.string() }) })
    .safeParse(json);
  if (parsed.success) {
    throw new Error(`Stremio ${method}: ${parsed.data.error.message}`);
  }
}

export type MtimeEntry = [string, number];

export async function datastoreMeta(
  authKey: string,
  collection: string,
): Promise<MtimeEntry[]> {
  const res = await fetch(`${STREMIO_API}/datastoreMeta`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authKey, collection }),
  });

  if (!res.ok) throw new Error(`datastoreMeta HTTP ${res.status}`);
  const json: unknown = await res.json();
  assertNotError(json, "datastoreMeta");

  const envelope = json as { result?: MtimeEntry[] };
  return envelope.result ?? [];
}

export async function datastoreGet(
  authKey: string,
  ids: string[],
): Promise<StremioLibraryItem[]> {
  const res = await fetch(`${STREMIO_API}/datastoreGet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authKey, collection: "libraryItem", ids }),
  });

  if (!res.ok) throw new Error(`datastoreGet HTTP ${res.status}`);
  const json: unknown = await res.json();
  assertNotError(json, "datastoreGet");

  const envelope = json as { result?: StremioLibraryItem[] };
  return envelope.result ?? [];
}

export async function datastorePut(
  authKey: string,
  items: StremioLibraryItem[],
): Promise<void> {
  const res = await fetch(`${STREMIO_API}/datastorePut`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authKey, collection: "libraryItem", changes: items }),
  });

  if (!res.ok) throw new Error(`datastorePut HTTP ${res.status}`);
  const json: unknown = await res.json();
  assertNotError(json, "datastorePut");
}
