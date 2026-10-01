import type { Currency, Market, MarketFilter, Region, StockSnapshot } from "./types";

export function formatPrice(value: number, currency: Currency = "KRW"): string {
  if (currency === "USD") {
    const digits = value >= 100 ? 2 : value >= 1 ? 2 : 4;
    return `$${value.toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })}`;
  }
  return Math.round(value).toLocaleString("ko-KR");
}

export function formatPct(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatMarketCap(value: number, currency: Currency = "KRW"): string {
  if (currency === "USD") {
    if (value >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    return `$${Math.round(value).toLocaleString("en-US")}`;
  }
  const jo = 1_000_000_000_000;
  const eok = 100_000_000;
  if (value >= jo) {
    const amount = value / jo;
    return `${amount.toFixed(amount >= 10 ? 1 : 2)}조`;
  }
  return `${Math.round(value / eok).toLocaleString("ko-KR")}억`;
}

export function formatVolume(value: number): string {
  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(1)}억`;
  }
  if (value >= 10_000) {
    return `${Math.round(value / 10_000).toLocaleString("ko-KR")}만`;
  }
  return value.toLocaleString("ko-KR");
}

export function formatMultiple(value: number): string {
  return `${value.toFixed(1)}배`;
}

export function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function isPreferredName(name: string): boolean {
  return /(우B|우C|우)$/.test(name) || /[0-9]우B$/.test(name) || /preferred/i.test(name);
}

export function isSpacName(name: string): boolean {
  return name.includes("스팩") || /acquisition/i.test(name) || /\bspac\b/i.test(name);
}

export function marketLabel(market: Market): string {
  if (market === "KOSPI") return "코스피";
  if (market === "KOSDAQ") return "코스닥";
  return "나스닥";
}

export function stockRegion(stock: { market: Market }): Region {
  return stock.market === "NASDAQ" ? "US" : "KR";
}

export function regionLabel(region: Region): string {
  return region === "KR" ? "한국" : "미국";
}

export function matchesMarket(stock: { market: Market }, filter: MarketFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "KR") return stock.market === "KOSPI" || stock.market === "KOSDAQ";
  if (filter === "US") return stock.market === "NASDAQ";
  return stock.market === filter;
}

export function groupByRegion(stocks: StockSnapshot[]): { kr: StockSnapshot[]; us: StockSnapshot[] } {
  const kr: StockSnapshot[] = [];
  const us: StockSnapshot[] = [];
  for (const stock of stocks) {
    if (stockRegion(stock) === "US") us.push(stock);
    else kr.push(stock);
  }
  return { kr, us };
}

export function stockDetailUrl(stock: { market: string; code: string; reutersCode?: string }): string {
  if (stock.market === "NASDAQ") {
    const reuters = stock.reutersCode || `${stock.code}.O`;
    return `https://finance.naver.com/worldstock/stock/${reuters}`;
  }
  return `https://finance.naver.com/item/main.naver?code=${stock.code}`;
}
