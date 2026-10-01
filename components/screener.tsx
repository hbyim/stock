"use client";

import { AppNav } from "@/components/nav";
import { Sparkline } from "@/components/sparkline";
import {
  MarketFilterSelect,
  RegionSection,
  ScanProgress,
  StatCard,
  StockDrawer,
  StockIdentity,
  toneClass,
} from "@/components/stock-ui";
import { useUniverse } from "@/components/use-universe";
import {
  formatMarketCap,
  formatPct,
  formatPrice,
  formatUpdatedAt,
  formatVolume,
  groupByRegion,
} from "@/lib/format";
import { passesScreen } from "@/lib/screen";
import type { MarketFilter, StockSnapshot } from "@/lib/types";
import { useMemo, useState } from "react";

type SortKey =
  | "dropPct"
  | "twoWeekRangePct"
  | "marketCap"
  | "volume"
  | "twoWeekChangePct"
  | "name";

const DEFAULTS = {
  dropPct: 30,
  rangePct: 5,
  market: "ALL" as MarketFilter,
  minMarketCapEok: 0,
  excludeSpac: true,
  excludePreferred: true,
  query: "",
  sortKey: "dropPct" as SortKey,
};

export function ScreenerApp() {
  const { status, data, error, setError, startScan, running, progress, staticHost } = useUniverse();
  const [dropPct, setDropPct] = useState(DEFAULTS.dropPct);
  const [rangePct, setRangePct] = useState(DEFAULTS.rangePct);
  const [market, setMarket] = useState(DEFAULTS.market);
  const [minMarketCapEok, setMinMarketCapEok] = useState(DEFAULTS.minMarketCapEok);
  const [excludeSpac, setExcludeSpac] = useState(DEFAULTS.excludeSpac);
  const [excludePreferred, setExcludePreferred] = useState(DEFAULTS.excludePreferred);
  const [query, setQuery] = useState(DEFAULTS.query);
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULTS.sortKey);
  const [selected, setSelected] = useState<StockSnapshot | null>(null);

  const screened = useMemo(() => {
    const stocks = data?.stocks ?? [];
    return stocks.filter((stock) =>
      passesScreen(stock, {
        dropPct,
        rangePct,
        market,
        minMarketCapEok,
        excludeSpac,
        excludePreferred,
      }),
    );
  }, [data, dropPct, rangePct, market, minMarketCapEok, excludeSpac, excludePreferred]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? screened.filter(
          (stock) =>
            stock.name.toLowerCase().includes(needle) || stock.code.toLowerCase().includes(needle),
        )
      : screened;

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name, "ko");
        case "twoWeekRangePct":
          return a.twoWeekRangePct - b.twoWeekRangePct;
        case "marketCap":
          return b.marketCapKrw - a.marketCapKrw;
        case "volume":
          return b.volume - a.volume;
        case "twoWeekChangePct":
          return Math.abs(a.twoWeekChangePct) - Math.abs(b.twoWeekChangePct);
        default:
          return b.dropPct - a.dropPct;
      }
    });
    return sorted;
  }, [screened, query, sortKey]);

  const droppedCount = useMemo(
    () => (data?.stocks ?? []).filter((stock) => stock.dropPct >= dropPct).length,
    [data, dropPct],
  );
  const screenedByRegion = useMemo(() => groupByRegion(screened), [screened]);
  const matchesByRegion = useMemo(() => groupByRegion(matches), [matches]);
  const showKr = market === "ALL" || market === "KR" || market === "KOSPI" || market === "KOSDAQ";
  const showUs = market === "ALL" || market === "US" || market === "NASDAQ";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-[0.22em] text-cyan-300/80">
            한국 · 미국 SCREENER
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            52주 고점 대비 눌림목 스크리너
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-300">
            최근 1년 일별 고가 대비{" "}
            <span className="text-white">{dropPct}% 이상 하락</span>했고, 최근 10거래일
            고가-저가 변동폭이{" "}
            <span className="text-white">{rangePct}% 이내</span>로 보합인 종목을 찾습니다.
            한국(코스피·코스닥)과 미국(나스닥) 시세는 네이버 금융 기준입니다.
          </p>
          <AppNav />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {data ? (
            <p className="text-sm text-slate-400">
              기준일 {data.asOfDate} · 업데이트 {formatUpdatedAt(data.updatedAt)}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => startScan(true).catch((err) => setError(err.message))}
            disabled={running || staticHost}
            className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running ? "스캔 중..." : staticHost ? "스냅샷 사용 중" : "데이터 새로고침"}
          </button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="분석 종목" value={data ? data.scanned.toLocaleString("ko-KR") : "-"} hint="한국·미국" />
        <StatCard label={`${dropPct}% 이상 하락`} value={data ? droppedCount.toLocaleString("ko-KR") : "-"} hint="52주 최고가 대비" />
        <StatCard
          label="한국 보합 충족"
          value={data ? screenedByRegion.kr.length.toLocaleString("ko-KR") : "-"}
          hint="코스피·코스닥"
          accent
        />
        <StatCard
          label="미국 보합 충족"
          value={data ? screenedByRegion.us.length.toLocaleString("ko-KR") : "-"}
          hint="나스닥"
          accent
        />
      </section>

      <ScanProgress status={status} progress={progress} />

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-[#101826]/80 p-4 shadow-2xl shadow-black/20 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-12">
          <label className="lg:col-span-3">
            <span className="mb-2 block text-xs font-medium text-slate-400">
              고점 대비 최소 하락률 {dropPct}%
            </span>
            <input
              type="range"
              min={20}
              max={60}
              step={1}
              value={dropPct}
              onChange={(event) => setDropPct(Number(event.target.value))}
              className="w-full accent-cyan-400"
            />
          </label>
          <label className="lg:col-span-3">
            <span className="mb-2 block text-xs font-medium text-slate-400">
              2주 보합 변동폭 {rangePct}% 이내
            </span>
            <input
              type="range"
              min={3}
              max={15}
              step={0.5}
              value={rangePct}
              onChange={(event) => setRangePct(Number(event.target.value))}
              className="w-full accent-cyan-400"
            />
          </label>
          <MarketFilterSelect value={market} onChange={setMarket} />
          <label className="lg:col-span-3">
            <span className="mb-2 block text-xs font-medium text-slate-400">
              최소 시가총액 {minMarketCapEok.toLocaleString("ko-KR")}억
            </span>
            <input
              type="range"
              min={0}
              max={5000}
              step={100}
              value={minMarketCapEok}
              onChange={(event) => setMinMarketCapEok(Number(event.target.value))}
              className="w-full accent-cyan-400"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="종목명 또는 코드 검색"
            className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400 lg:max-w-xs"
          />
          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
          >
            <option value="dropPct">고점 대비 하락 큰 순</option>
            <option value="twoWeekRangePct">2주 변동폭 작은 순</option>
            <option value="twoWeekChangePct">2주 등락 작은 순</option>
            <option value="marketCap">시가총액 큰 순</option>
            <option value="volume">거래량 많은 순</option>
            <option value="name">이름순</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={excludeSpac}
              onChange={(event) => setExcludeSpac(event.target.checked)}
              className="accent-cyan-400"
            />
            스팩 제외
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={excludePreferred}
              onChange={(event) => setExcludePreferred(event.target.checked)}
              className="accent-cyan-400"
            />
            우선주 제외
          </label>
        </div>

        <div className="mt-5 space-y-8">
          {!data && matches.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">
              {running ? "종목을 모으는 동안 잠시만 기다려 주세요." : "아직 데이터가 없습니다."}
            </p>
          ) : (
            <>
              {showKr ? (
                <RegionSection
                  title="한국 주식"
                  count={matchesByRegion.kr.length}
                  empty="조건에 맞는 한국 종목이 없습니다. 하락률이나 보합 폭을 조정해 보세요."
                >
                  <PullbackTable stocks={matchesByRegion.kr} onSelect={setSelected} />
                </RegionSection>
              ) : null}
              {showUs ? (
                <RegionSection
                  title="미국 주식"
                  count={matchesByRegion.us.length}
                  empty="조건에 맞는 미국 종목이 없습니다. 하락률이나 보합 폭을 조정해 보세요."
                >
                  <PullbackTable stocks={matchesByRegion.us} onSelect={setSelected} />
                </RegionSection>
              ) : null}
            </>
          )}
        </div>
      </section>

      {selected ? <StockDrawer stock={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function PullbackTable({
  stocks,
  onSelect,
}: {
  stocks: StockSnapshot[];
  onSelect: (stock: StockSnapshot) => void;
}) {
  return (
    <table className="min-w-[980px] w-full text-left text-sm">
      <thead className="text-xs uppercase tracking-wide text-slate-500">
        <tr className="border-b border-white/10">
          <th className="py-3 pr-3 font-medium">종목</th>
          <th className="py-3 pr-3 font-medium">현재가</th>
          <th className="py-3 pr-3 font-medium">52주 최고</th>
          <th className="py-3 pr-3 font-medium">고점 대비</th>
          <th className="py-3 pr-3 font-medium">2주 변동폭</th>
          <th className="py-3 pr-3 font-medium">2주 등락</th>
          <th className="py-3 pr-3 font-medium">2주 추이</th>
          <th className="py-3 pr-3 font-medium">시가총액</th>
          <th className="py-3 font-medium">거래량</th>
        </tr>
      </thead>
      <tbody>
        {stocks.map((stock) => (
          <tr
            key={`${stock.market}-${stock.code}`}
            onClick={() => onSelect(stock)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(stock);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`${stock.name} 상세 보기`}
            className="cursor-pointer border-b border-white/5 outline-none transition hover:bg-white/5 focus:bg-white/5"
          >
            <td className="py-3 pr-3">
              <StockIdentity stock={stock} />
            </td>
            <td className="py-3 pr-3">
              <div className="tabular-nums text-white">{formatPrice(stock.price, stock.currency)}</div>
              <div className={`text-xs ${toneClass(stock.changePct)}`}>{formatPct(stock.changePct)}</div>
            </td>
            <td className="py-3 pr-3 tabular-nums text-slate-200">
              <div>{formatPrice(stock.high52, stock.currency)}</div>
              <div className="text-xs text-slate-500">{stock.high52Date}</div>
            </td>
            <td className="py-3 pr-3 font-semibold tabular-nums text-sky-400">-{stock.dropPct.toFixed(1)}%</td>
            <td className="py-3 pr-3 tabular-nums text-emerald-300">{stock.twoWeekRangePct.toFixed(1)}%</td>
            <td className={`py-3 pr-3 tabular-nums ${toneClass(stock.twoWeekChangePct)}`}>
              {formatPct(stock.twoWeekChangePct)}
            </td>
            <td className="py-3 pr-3">
              <Sparkline values={stock.sparkline} className="h-7 w-[88px]" />
            </td>
            <td className="py-3 pr-3 tabular-nums text-slate-200">
              {formatMarketCap(stock.marketCap, stock.currency)}
            </td>
            <td className="py-3 tabular-nums text-slate-200">{formatVolume(stock.volume)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
