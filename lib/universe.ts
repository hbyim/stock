import { isCurrentUniverse, readUniverseCache, writeUniverseCache } from "./cache";
import { fetchUsdKrw, fetchNasdaqListings, fetchNasdaqOhlcv } from "./nasdaq";
import { fetchAllListings, fetchOhlcv, historyWindow } from "./naver";
import { toSnapshot } from "./screen";
import type { ListedStock, ScanStatus, StockSnapshot, UniversePayload } from "./types";
import { UNIVERSE_VERSION } from "./types";

const CONCURRENCY = 14;

type Job = {
  status: "idle" | "running" | "done" | "error";
  done: number;
  total: number;
  failed: number;
  message?: string;
  data?: UniversePayload;
  promise?: Promise<UniversePayload>;
};

const globalForJob = globalThis as typeof globalThis & { stockScanJob?: Job };

const job: Job = globalForJob.stockScanJob ?? {
  status: "idle",
  done: 0,
  total: 0,
  failed: 0,
};

globalForJob.stockScanJob = job;

async function mapPool<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
  onProgress: (done: number) => void,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  let completed = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
      completed += 1;
      onProgress(completed);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function fetchBars(listing: ListedStock, start: string, end: string) {
  if (listing.market === "NASDAQ") {
    return fetchNasdaqOhlcv(listing.reutersCode || `${listing.code}.O`, start, end);
  }
  return fetchOhlcv(listing.code, start, end);
}

function koreanStocks(data: UniversePayload | null): StockSnapshot[] {
  return (data?.stocks ?? [])
    .filter((stock) => stock.market === "KOSPI" || stock.market === "KOSDAQ")
    .map((stock) => ({
      ...stock,
      currency: stock.currency ?? "KRW",
      marketCapKrw: stock.marketCapKrw ?? stock.marketCap,
    }));
}

async function runScan(refresh: boolean): Promise<UniversePayload> {
  const usdKrw = await fetchUsdKrw();
  const cached = await readUniverseCache({ allowStale: true });
  const reusedKorean = !refresh && cached?.version === UNIVERSE_VERSION ? koreanStocks(cached) : [];
  const canReuseKorean = reusedKorean.length > 1000;

  const [koreanListings, nasdaqListings] = await Promise.all([
    canReuseKorean ? Promise.resolve([]) : fetchAllListings(),
    fetchNasdaqListings(usdKrw),
  ]);

  const listings = [...koreanListings, ...nasdaqListings].filter(
    (stock) => stock.trading && stock.price > 0,
  );

  job.total = listings.length + reusedKorean.length;
  job.done = reusedKorean.length;
  job.failed = 0;

  const { start, end } = historyWindow();
  const snapshots = await mapPool(
    listings,
    CONCURRENCY,
    async (listing) => {
      try {
        const bars = await fetchBars(listing, start, end);
        return toSnapshot(listing, bars);
      } catch {
        job.failed += 1;
        return null;
      }
    },
    (done) => {
      job.done = reusedKorean.length + done;
    },
  );

  const stocks = [
    ...reusedKorean,
    ...snapshots.filter((stock): stock is StockSnapshot => stock !== null),
  ];
  stocks.sort((a, b) => b.dropPct - a.dropPct);

  const payload: UniversePayload = {
    version: UNIVERSE_VERSION,
    updatedAt: new Date().toISOString(),
    asOfDate: stocks[0]?.asOfDate ?? end.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"),
    scanned: stocks.length + job.failed,
    failed: job.failed,
    usdKrw,
    stocks,
  };

  await writeUniverseCache(payload);
  job.data = payload;
  job.status = "done";
  return payload;
}

export async function getScanStatus(): Promise<ScanStatus> {
  if (job.status === "running") {
    return {
      status: "running",
      done: job.done,
      total: job.total,
      failed: job.failed,
    };
  }
  if (job.status === "error") {
    return {
      status: "error",
      message: job.message ?? "스캔에 실패했습니다.",
      done: job.done,
      total: job.total,
    };
  }
  if (isCurrentUniverse(job.data)) {
    return { status: "done", data: job.data };
  }

  const cached = await readUniverseCache();
  if (isCurrentUniverse(cached)) {
    job.data = cached;
    job.status = "done";
    return { status: "done", data: cached };
  }
  return { status: "idle" };
}

export async function startScan(refresh = false): Promise<ScanStatus> {
  if (job.status === "running" && job.promise) {
    return getScanStatus();
  }

  if (!refresh) {
    const current = await getScanStatus();
    if (current.status === "done") return current;
  }

  job.status = "running";
  job.done = 0;
  job.total = 0;
  job.failed = 0;
  job.message = undefined;
  job.promise = runScan(refresh).catch((error: unknown) => {
    job.status = "error";
    job.message = error instanceof Error ? error.message : "스캔에 실패했습니다.";
    throw error;
  });

  return getScanStatus();
}
