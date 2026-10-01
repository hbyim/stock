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
  formatMultiple,
  formatPct,
  formatPrice,
  formatUpdatedAt,
  formatVolume,
  groupByRegion,
} from "@/lib/format";
import { passesVolumeScreen } from "@/lib/screen";
import type { MarketFilter, StockSnapshot } from "@/lib/types";
import { useMemo, useState } from "react";

type SortKey = "volumeRatio" | "monthChangePct" | "changePct" | "marketCap" | "volume" | "name";

const DEFAULTS = {
  volumeMultiple: 3,
  maxChangePct: 4,
  market: "ALL" as MarketFilter,
  minMarketCapEok: 0,
  excludeSpac: true,
  excludePreferred: true,
  query: "",
  sortKey: "volumeRatio" as SortKey,
};

export function VolumeScreenerApp() {
  const { status, data, error, setError, startScan, running, progress, staticHost } = useUniverse();
  const [volumeMultiple, setVolumeMultiple] = useState(DEFAULTS.volumeMultiple);
  const [maxChangePct, setMaxChangePct] = useState(DEFAULTS.maxChangePct);
  const [market, setMarket] = useState(DEFAULTS.market);
  const [minMarketCapEok, setMinMarketCapEok] = useState(DEFAULTS.minMarketCapEok);
  const [excludeSpac, setExcludeSpac] = useState(DEFAULTS.excludeSpac);
  const [excludePreferred, setExcludePreferred] = useState(DEFAULTS.excludePreferred);
  const [query, setQuery] = useState(DEFAULTS.query);
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULTS.sortKey);
  const [selected, setSelected] = useState<StockSnapshot | null>(null);

  const volumeHits = useMemo(() => {
    return (data?.stocks ?? []).filter((stock) => (stock.volumeRatio ?? 0) >= volumeMultiple);
  }, [data, volumeMultiple]);

  const screened = useMemo(() => {
    return (data?.stocks ?? []).filter((stock) =>
      passesVolumeScreen(stock, {
        volumeMultiple,
        maxChangePct,
        market,
        minMarketCapEok,
        excludeSpac,
        excludePreferred,
      }),
    );
  }, [data, volumeMultiple, maxChangePct, market, minMarketCapEok, excludeSpac, excludePreferred]);

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
        case "monthChangePct":
          return a.monthChangePct - b.monthChangePct;
        case "changePct":
          return a.changePct - b.changePct;
        case "marketCap":
          return b.marketCapKrw - a.marketCapKrw;
        case "volume":
          return b.volume - a.volume;
        default:
          return b.volumeRatio - a.volumeRatio;
      }
    });
    return sorted;
  }, [screened, query, sortKey]);
  const screenedByRegion = useMemo(() => groupByRegion(screened), [screened]);
  const matchesByRegion = useMemo(() => groupByRegion(matches), [matches]);
  const showKr = market === "ALL" || market === "KR" || market === "KOSPI" || market === "KOSDAQ";
  const showUs = market === "ALL" || market === "US" || market === "NASDAQ";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-[0.22em] text-cyan-300/80">
            한국 · 미국 VOLUME SURGE
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            거래량 급증 · 저상승 스크리너
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-300">
            최근 20거래일 평균 거래량이 직전 20거래일 대비{" "}
            <span className="text-white">{volumeMultiple}배 이상</span> 늘었고, 같은 기간
            수익률이 <span className="text-white">{maxChangePct}% 이하</span>인 종목을
            찾습니다. 한국(코스피·코스닥)과 미국(나스닥) 시세는 네이버 금융 기준입니다.
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
        <StatCard
          label="분석 종목"
          value={data ? data.scanned.toLocaleString("ko-KR") : "-"}
          hint="한국·미국"
        />
        <StatCard
          label={`${volumeMultiple}배 이상 증가`}
          value={data ? volumeHits.length.toLocaleString("ko-KR") : "-"}
          hint="최근 1개월 평균 / 직전 1개월 평균"
        />
        <StatCard
          label="한국 저상승 충족"
          value={data ? screenedByRegion.kr.length.toLocaleString("ko-KR") : "-"}
          hint="코스피·코스닥"
          accent
        />
        <StatCard
          label="미국 저상승 충족"
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
              최소 거래량 배수 {volumeMultiple}배
            </span>
            <input
              type="range"
              min={2}
              max={10}
              step={0.5}
              value={volumeMultiple}
              onChange={(event) => setVolumeMultiple(Number(event.target.value))}
              className="w-full accent-cyan-400"
            />
          </label>
          <label className="lg:col-span-3">
            <span className="mb-2 block text-xs font-medium text-slate-400">
              최대 1개월 수익률 {maxChangePct}%
            </span>
            <input
              type="range"
              min={-10}
              max={15}
              step={1}
              value={maxChangePct}
              onChange={(event) => setMaxChangePct(Number(event.target.value))}
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
            <option value="volumeRatio">거래량 배수 큰 순</option>
            <option value="monthChangePct">1개월 등락 낮은 순</option>
            <option value="changePct">당일 등락 낮은 순</option>
            <option value="marketCap">시가총액 큰 순</option>
            <option value="volume">당일 거래량 많은 순</option>
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
                  empty="조건에 맞는 한국 종목이 없습니다. 거래량 배수나 수익률 한도를 조정해 보세요."
                >
                  <VolumeTable stocks={matchesByRegion.kr} onSelect={setSelected} />
                </RegionSection>
              ) : null}
              {showUs ? (
                <RegionSection
                  title="미국 주식"
                  count={matchesByRegion.us.length}
                  empty="조건에 맞는 미국 종목이 없습니다. 거래량 배수나 수익률 한도를 조정해 보세요."
                >
                  <VolumeTable stocks={matchesByRegion.us} onSelect={setSelected} />
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

function VolumeTable({
  stocks,
  onSelect,
}: {
  stocks: StockSnapshot[];
  onSelect: (stock: StockSnapshot) => void;
}) {
  return (
    <table className="min-w-[1080px] w-full text-left text-sm">
      <thead className="text-xs uppercase tracking-wide text-slate-500">
        <tr className="border-b border-white/10">
          <th className="py-3 pr-3 font-medium">종목</th>
          <th className="py-3 pr-3 font-medium">현재가</th>
          <th className="py-3 pr-3 font-medium">거래량 배수</th>
          <th className="py-3 pr-3 font-medium">1개월 등락</th>
          <th className="py-3 pr-3 font-medium">당일 등락</th>
          <th className="py-3 pr-3 font-medium">평균 거래량</th>
          <th className="py-3 pr-3 font-medium">2주 추이</th>
          <th className="py-3 font-medium">시가총액</th>
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
            </td>
            <td className="py-3 pr-3 font-semibold tabular-nums text-amber-300">
              {formatMultiple(stock.volumeRatio ?? 0)}
            </td>
            <td className={`py-3 pr-3 tabular-nums ${toneClass(stock.monthChangePct ?? 0)}`}>
              {formatPct(stock.monthChangePct ?? 0)}
            </td>
            <td className={`py-3 pr-3 tabular-nums ${toneClass(stock.changePct)}`}>
              {formatPct(stock.changePct)}
            </td>
            <td className="py-3 pr-3 text-xs tabular-nums text-slate-300">
              <div>최근 {formatVolume(stock.recentAvgVolume ?? stock.volume)}</div>
              <div className="text-slate-500">직전 {formatVolume(stock.avgVolume20 ?? 0)}</div>
            </td>
            <td className="py-3 pr-3">
              <Sparkline values={stock.sparkline} className="h-7 w-[88px]" />
            </td>
            <td className="py-3 tabular-nums text-slate-200">
              {formatMarketCap(stock.marketCap, stock.currency)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
