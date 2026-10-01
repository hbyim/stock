import type { ListedStock, Market, OhlcvBar } from "./types";

const NAVER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  Referer: "https://finance.naver.com/",
  Accept: "application/json,text/plain,*/*",
};

const PAGE_SIZE = 100;
const TWO_WEEK_BARS = 10;

type NaverListingResponse = {
  totalCount: number;
  stocks?: NaverListedStock[];
};

type NaverListedStock = {
  itemCode?: string;
  stockName?: string;
  stockEndType?: string;
  closePriceRaw?: string | number;
  fluctuationsRatio?: string;
  accumulatedTradingVolumeRaw?: string | number;
  marketValueRaw?: string | number;
  itemLogoPngUrl?: string;
  itemLogoUrl?: string;
  tradeStopType?: { name?: string };
  stockExchangeType?: { name?: string };
};

export function parseNumber(value: string | number | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const parsed = Number(String(value).replace(/,/g, "").replace(/%/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: NAVER_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error(`네이버 요청 실패 (${response.status})`);
  }
  return response.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const text = await fetchText(url);
  return JSON.parse(text) as T;
}

async function fetchWithRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (i + 1)));
    }
  }
  throw lastError;
}

function yyyymmdd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function historyWindow(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 400);
  return { start: yyyymmdd(start), end: yyyymmdd(end) };
}

export async function fetchMarketListings(market: Market): Promise<ListedStock[]> {
  const first = await fetchWithRetry(() =>
    fetchJson<NaverListingResponse>(
      `https://m.stock.naver.com/api/stocks/marketValue/${market}?page=1&pageSize=${PAGE_SIZE}`,
    ),
  );

  const total = first.totalCount ?? first.stocks?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pages = [first];

  if (pageCount > 1) {
    const rest = await Promise.all(
      Array.from({ length: pageCount - 1 }, (_, index) =>
        fetchWithRetry(() =>
          fetchJson<NaverListingResponse>(
            `https://m.stock.naver.com/api/stocks/marketValue/${market}?page=${index + 2}&pageSize=${PAGE_SIZE}`,
          ),
        ),
      ),
    );
    pages.push(...rest);
  }

  const listings: ListedStock[] = [];
  for (const page of pages) {
    for (const stock of page.stocks ?? []) {
      if (stock.stockEndType !== "stock" || !stock.itemCode || !stock.stockName) {
        continue;
      }
      const marketCap = parseNumber(stock.marketValueRaw);
      listings.push({
        code: stock.itemCode,
        name: stock.stockName,
        market,
        currency: "KRW",
        price: parseNumber(stock.closePriceRaw),
        changePct: parseNumber(stock.fluctuationsRatio),
        volume: parseNumber(stock.accumulatedTradingVolumeRaw),
        marketCap,
        marketCapKrw: marketCap,
        logoUrl: stock.itemLogoPngUrl || stock.itemLogoUrl || null,
        trading: stock.tradeStopType?.name === "TRADING",
      });
    }
  }
  return listings;
}

export async function fetchAllListings(): Promise<ListedStock[]> {
  const [kospi, kosdaq] = await Promise.all([
    fetchMarketListings("KOSPI"),
    fetchMarketListings("KOSDAQ"),
  ]);
  return [...kospi, ...kosdaq].filter((stock) => stock.trading && stock.price > 0);
}

export async function fetchOhlcv(code: string, start: string, end: string): Promise<OhlcvBar[]> {
  const url = `https://api.finance.naver.com/siseJson.naver?symbol=${code}&requestType=1&startTime=${start}&endTime=${end}&timeframe=day`;
  const text = await fetchWithRetry(() => fetchText(url));
  const normalized = text.replace(/'/g, '"').trim();
  if (!normalized.startsWith("[")) {
    throw new Error("시세 응답 형식 오류");
  }

  const rows = JSON.parse(normalized) as unknown[];
  const bars: OhlcvBar[] = [];
  for (const row of rows.slice(1)) {
    if (!Array.isArray(row) || row.length < 6) continue;
    const date = String(row[0]);
    const open = Number(row[1]);
    const high = Number(row[2]);
    const low = Number(row[3]);
    const close = Number(row[4]);
    const volume = Number(row[5]);
    if (!date || ![open, high, low, close].every((value) => Number.isFinite(value) && value > 0)) {
      continue;
    }
    bars.push({
      date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
      open,
      high,
      low,
      close,
      volume: Number.isFinite(volume) ? volume : 0,
    });
  }
  return bars;
}

export { TWO_WEEK_BARS };
