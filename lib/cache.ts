import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { UNIVERSE_VERSION, type UniversePayload } from "./types";

const CACHE_PATH = path.join(process.cwd(), ".cache", "universe.json");
export const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export function isCurrentUniverse(data: UniversePayload | null | undefined): data is UniversePayload {
  if (!data?.stocks?.length || !data.updatedAt) return false;
  if (data.version !== UNIVERSE_VERSION) return false;
  return data.stocks.some((stock) => stock.market === "NASDAQ" && typeof stock.volumeRatio === "number");
}

export async function readUniverseCache(options?: { allowStale?: boolean }): Promise<UniversePayload | null> {
  try {
    const raw = await readFile(CACHE_PATH, "utf8");
    const data = JSON.parse(raw) as UniversePayload;
    if (!data?.stocks || !data.updatedAt) return null;
    if (Date.now() - new Date(data.updatedAt).getTime() > MAX_AGE_MS) return null;
    if (!options?.allowStale && !isCurrentUniverse(data)) return null;
    return data;
  } catch {
    return null;
  }
}

export async function writeUniverseCache(data: UniversePayload): Promise<void> {
  await mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(data), "utf8");
}
