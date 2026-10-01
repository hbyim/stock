export type Market = "KOSPI" | "KOSDAQ" | "NASDAQ";
export type Region = "KR" | "US";
export type MarketFilter = "ALL" | Region | Market;
export type Currency = "KRW" | "USD";

export type ListedStock = {
  code: string;
  name: string;
  nameEng?: string;
  market: Market;
  currency: Currency;
  price: number;
  changePct: number;
  volume: number;
  marketCap: number;
  marketCapKrw: number;
  reutersCode?: string;
  logoUrl: string | null;
  trading: boolean;
};

export type OhlcvBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type StockSnapshot = {
  code: string;
  name: string;
  market: Market;
  currency: Currency;
  price: number;
  changePct: number;
  high52: number;
  high52Date: string;
  dropPct: number;
  twoWeekHigh: number;
  twoWeekLow: number;
  twoWeekRangePct: number;
  twoWeekChangePct: number;
  volume: number;
  marketCap: number;
  marketCapKrw: number;
  sparkline: number[];
  listedDays: number;
  asOfDate: string;
  isPreferred: boolean;
  isSpac: boolean;
  reutersCode?: string;
  logoUrl: string | null;
  avgVolume20: number;
  recentAvgVolume: number;
  volumeRatio: number;
  monthChangePct: number;
};

export const UNIVERSE_VERSION = 3;

export type UniversePayload = {
  version: number;
  updatedAt: string;
  asOfDate: string;
  scanned: number;
  failed: number;
  usdKrw: number;
  stocks: StockSnapshot[];
};

export type ScanStatus =
  | {
      status: "idle";
    }
  | {
      status: "running";
      done: number;
      total: number;
      failed: number;
    }
  | {
      status: "done";
      data: UniversePayload;
    }
  | {
      status: "error";
      message: string;
      done: number;
      total: number;
    };
