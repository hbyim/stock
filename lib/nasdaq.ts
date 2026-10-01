import { parseNumber } from "./naver";
import type { ListedStock, OhlcvBar } from "./types";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  Referer: "https://m.stock.naver.com/",
  Accept: "application/json,text/plain,*/*",
};

const PAGE_SIZE = 100;
const FALLBACK_USD_KRW = 1400;

type NasdaqListingResponse = {
  totalCount?: number;
  stocks?: NasdaqListedStock[];
};

type NasdaqListedStock = {
  stockEndType?: string;
  reutersCode?: string;
  symbolCode?: string;
  stockName?: string;
  stockNameEng?: string;
  closePriceRaw?: string | number;
  fluctuationsRatio?: string;
  fluctuationsRatioRaw?: string | number;
  accumulatedTradingVolumeRaw?: string | number;
  marketValueRaw?: string | number;
  itemLogoPngUrl?: string;
  itemLogoUrl?: string;
  tradeStopType?: { name?: string };
};

type NasdaqBar = {
  localDate?: string;
  openPrice?: number;
  highPrice?: number;
  lowPrice?: number;
  closePrice?: number;
  accumulatedTradingVolume?: number;
};

type FxResponse = {
  result?: { calcPrice?: number; closePrice?: string };
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error(`요청 실패 (${response.status})`);
  }
  return (await response.json()) as T;
}

async function fetchWithRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 300 * (i + 1)));
    }
  }
  throw lastError;
}

export async function fetchUsdKrw(): Promise<number> {
  try {
    const data = await fetchWithRetry(() =>
      fetchJson<FxResponse>(
        "https://m.stock.naver.com/front-api/marketIndex/productDetail?category=exchange&reutersCode=FX_USDKRW",
      ),
    );
    const price = Number(data.result?.calcPrice ?? parseNumber(data.result?.closePrice));
    if (price > 100) return price;
  } catch {
    // fallback below
  }
  return FALLBACK_USD_KRW;
}

export async function fetchNasdaqListings(usdKrw: number): Promise<ListedStock[]> {
  const first = await fetchWithRetry(() =>
    fetchJson<NasdaqListingResponse>(
      `https://api.stock.naver.com/stock/exchange/NASDAQ/marketValue?page=1&pageSize=${PAGE_SIZE}`,
    ),
  );
  const total = first.totalCount ?? first.stocks?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pages = [first];

  if (pageCount > 1) {
    const rest = await Promise.all(
      Array.from({ length: pageCount - 1 }, (_, index) =>
        fetchWithRetry(() =>
          fetchJson<NasdaqListingResponse>(
            `https://api.stock.naver.com/stock/exchange/NASDAQ/marketValue?page=${index + 2}&pageSize=${PAGE_SIZE}`,
          ),
        ),
      ),
    );
    pages.push(...rest);
  }

  const listings: ListedStock[] = [];
  for (const page of pages) {
    for (const stock of page.stocks ?? []) {
      const code = stock.symbolCode;
      if (stock.stockEndType !== "stock" || !code || !stock.stockName) continue;
      const marketCap = parseNumber(stock.marketValueRaw);
      if (marketCap <= 0) continue;
      listings.push({
        code,
        name: stock.stockName,
        nameEng: stock.stockNameEng,
        market: "NASDAQ",
        currency: "USD",
        price: parseNumber(stock.closePriceRaw),
        changePct: parseNumber(stock.fluctuationsRatioRaw ?? stock.fluctuationsRatio),
        volume: parseNumber(stock.accumulatedTradingVolumeRaw),
        marketCap,
        marketCapKrw: marketCap * usdKrw,
        reutersCode: stock.reutersCode || `${code}.O`,
        logoUrl: stock.itemLogoPngUrl || stock.itemLogoUrl || null,
        trading: stock.tradeStopType?.name === "TRADING",
      });
    }
  }
  return listings;
}

function formatLocalDate(value: string): string {
  if (value.length === 8) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  return value;
}

export async function fetchNasdaqOhlcv(
  reutersCode: string,
  start: string,
  end: string,
): Promise<OhlcvBar[]> {
  const url = `https://api.stock.naver.com/chart/foreign/item/${encodeURIComponent(reutersCode)}/day?startDateTime=${start}&endDateTime=${end}`;
  const rows = await fetchWithRetry(() => fetchJson<NasdaqBar[]>(url));
  const bars: OhlcvBar[] = [];
  for (const row of rows) {
    const open = Number(row.openPrice);
    const high = Number(row.highPrice);
    const low = Number(row.lowPrice);
    const close = Number(row.closePrice);
    if (!row.localDate || ![open, high, low, close].every((value) => Number.isFinite(value) && value > 0)) {
      continue;
    }
    bars.push({
      date: formatLocalDate(row.localDate),
      open,
      high,
      low,
      close,
      volume: Number(row.accumulatedTradingVolume) || 0,
    });
  }
  return bars;
}
