import { isPreferredName, isSpacName, matchesMarket } from "./format";
import { TWO_WEEK_BARS } from "./naver";
import type { ListedStock, MarketFilter, OhlcvBar, StockSnapshot } from "./types";

export const MONTH_BARS = 20;

function averageVolume(bars: OhlcvBar[]): number {
  const volumes = bars.map((bar) => bar.volume).filter((volume) => volume > 0);
  if (volumes.length === 0) return 0;
  return volumes.reduce((sum, volume) => sum + volume, 0) / volumes.length;
}

export function toSnapshot(listing: ListedStock, bars: OhlcvBar[]): StockSnapshot | null {
  if (bars.length < TWO_WEEK_BARS) return null;

  let high52 = 0;
  let high52Date = bars[0].date;
  for (const bar of bars) {
    if (bar.high > high52) {
      high52 = bar.high;
      high52Date = bar.date;
    }
  }
  if (high52 <= 0) return null;

  const last = bars[bars.length - 1];
  const recent = bars.slice(-TWO_WEEK_BARS);
  const twoWeekHigh = Math.max(...recent.map((bar) => bar.high));
  const twoWeekLow = Math.min(...recent.map((bar) => bar.low));
  const firstClose = recent[0].close;
  const denom = last.close || (twoWeekLow + twoWeekHigh) / 2;
  const twoWeekRangePct = denom > 0 ? ((twoWeekHigh - twoWeekLow) / denom) * 100 : 0;
  const dropPct = ((high52 - last.close) / high52) * 100;

  const recentMonth = bars.slice(-MONTH_BARS);
  const priorMonth = bars.slice(-MONTH_BARS * 2, -MONTH_BARS);
  const recentAvgVolume = averageVolume(recentMonth);
  const avgVolume20 = averageVolume(priorMonth.length >= 10 ? priorMonth : recentMonth.slice(0, -5));
  const volumeRatio = avgVolume20 > 0 ? recentAvgVolume / avgVolume20 : 0;
  const monthStart = recentMonth[0]?.close ?? last.close;
  const monthChangePct = monthStart > 0 ? ((last.close - monthStart) / monthStart) * 100 : 0;

  return {
    code: listing.code,
    name: listing.name,
    market: listing.market,
    currency: listing.currency,
    price: last.close,
    changePct: listing.changePct,
    high52,
    high52Date,
    dropPct,
    twoWeekHigh,
    twoWeekLow,
    twoWeekRangePct,
    twoWeekChangePct: firstClose > 0 ? ((last.close - firstClose) / firstClose) * 100 : 0,
    volume: last.volume || listing.volume,
    marketCap: listing.marketCap,
    marketCapKrw: listing.marketCapKrw,
    sparkline: recent.map((bar) => bar.close),
    listedDays: bars.length,
    asOfDate: last.date,
    isPreferred: isPreferredName(listing.name) || isPreferredName(listing.nameEng ?? ""),
    isSpac: isSpacName(listing.name) || isSpacName(listing.nameEng ?? ""),
    reutersCode: listing.reutersCode,
    logoUrl: listing.logoUrl,
    avgVolume20,
    recentAvgVolume,
    volumeRatio,
    monthChangePct,
  };
}

export function passesScreen(
  stock: StockSnapshot,
  options: {
    dropPct: number;
    rangePct: number;
    market: MarketFilter;
    minMarketCapEok: number;
    excludeSpac: boolean;
    excludePreferred: boolean;
  },
): boolean {
  if (!matchesMarket(stock, options.market)) return false;
  if (options.excludeSpac && stock.isSpac) return false;
  if (options.excludePreferred && stock.isPreferred) return false;
  if (stock.dropPct < options.dropPct) return false;
  if (stock.twoWeekRangePct > options.rangePct) return false;
  if (stock.marketCap <= 0) return false;
  if (options.minMarketCapEok > 0 && stock.marketCapKrw < options.minMarketCapEok * 100_000_000) {
    return false;
  }
  return true;
}

export function passesVolumeScreen(
  stock: StockSnapshot,
  options: {
    volumeMultiple: number;
    maxChangePct: number;
    market: MarketFilter;
    minMarketCapEok: number;
    excludeSpac: boolean;
    excludePreferred: boolean;
  },
): boolean {
  if (!matchesMarket(stock, options.market)) return false;
  if (options.excludeSpac && stock.isSpac) return false;
  if (options.excludePreferred && stock.isPreferred) return false;
  if (stock.marketCap <= 0) return false;
  if ((stock.volumeRatio ?? 0) < options.volumeMultiple) return false;
  if ((stock.monthChangePct ?? 0) > options.maxChangePct) return false;
  if (options.minMarketCapEok > 0 && stock.marketCapKrw < options.minMarketCapEok * 100_000_000) {
    return false;
  }
  return true;
}

export function passesBothScreens(
  stock: StockSnapshot,
  options: {
    dropPct: number;
    rangePct: number;
    volumeMultiple: number;
    maxChangePct: number;
    market: MarketFilter;
    minMarketCapEok: number;
    excludeSpac: boolean;
    excludePreferred: boolean;
  },
): boolean {
  return passesScreen(stock, options) && passesVolumeScreen(stock, options);
}
