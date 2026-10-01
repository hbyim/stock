"use client";

import { Sparkline } from "@/components/sparkline";
import {
  formatMarketCap,
  formatMultiple,
  formatPct,
  formatPrice,
  marketLabel,
  regionLabel,
  stockDetailUrl,
  stockRegion,
} from "@/lib/format";
import type { MarketFilter, ScanStatus, StockSnapshot } from "@/lib/types";
import { useState, type ReactNode } from "react";

export function toneClass(value: number): string {
  if (value > 0) return "text-red-400";
  if (value < 0) return "text-sky-400";
  return "text-slate-400";
}

export function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent ? "border-cyan-400/30 bg-cyan-400/10" : "border-white/10 bg-white/5"
      }`}
    >
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-white">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}

export function Logo({ name, src }: { name: string; src: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-300">
        {name.slice(0, 1)}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-9 w-9 rounded-full bg-white object-contain"
      onError={() => setFailed(true)}
    />
  );
}

export function ScanProgress({
  status,
  progress,
}: {
  status: ScanStatus;
  progress: number;
}) {
  if (status.status !== "running") return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
        <span>한국·나스닥 종목 시세를 수집하는 중입니다.</span>
        <span>
          {status.total > 0
            ? `${status.done.toLocaleString("ko-KR")} / ${status.total.toLocaleString("ko-KR")}`
            : "준비 중"}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export function StockDrawer({
  stock,
  onClose,
}: {
  stock: StockSnapshot;
  onClose: () => void;
}) {
  const detailUrl = stockDetailUrl(stock);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="닫기" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-[#121b2b] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo name={stock.name} src={stock.logoUrl} />
            <div>
              <h2 className="text-xl font-semibold text-white">{stock.name}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-slate-400">
                <RegionBadge stock={stock} />
                <span>
                  {marketLabel(stock.market)} {stock.code}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
          >
            닫기
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <Detail label="현재가" value={formatPrice(stock.price, stock.currency)} />
          <Detail label="등락률" value={formatPct(stock.changePct)} />
          <Detail label="52주 최고" value={`${formatPrice(stock.high52, stock.currency)} (${stock.high52Date})`} />
          <Detail label="고점 대비" value={`-${stock.dropPct.toFixed(1)}%`} />
          <Detail label="1개월 등락" value={formatPct(stock.monthChangePct ?? 0)} />
          <Detail label="거래량 배수" value={formatMultiple(stock.volumeRatio ?? 0)} />
          <Detail
            label="2주 고가 / 저가"
            value={`${formatPrice(stock.twoWeekHigh, stock.currency)} / ${formatPrice(stock.twoWeekLow, stock.currency)}`}
          />
          <Detail label="시가총액" value={formatMarketCap(stock.marketCap, stock.currency)} />
        </div>
        <div className="mt-5 rounded-2xl bg-slate-950/70 p-4">
          <div className="mb-2 text-xs text-slate-500">최근 10거래일 종가</div>
          <Sparkline values={stock.sparkline} className="h-16 w-full" />
        </div>
        <a
          href={detailUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-5 flex h-11 items-center justify-center rounded-full bg-cyan-400 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
        >
          네이버 금융에서 보기
        </a>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-white">{value}</div>
    </div>
  );
}

export function RegionBadge({ stock }: { stock: StockSnapshot }) {
  const region = stockRegion(stock);
  const korean = region === "KR";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
        korean ? "bg-rose-500/15 text-rose-300" : "bg-sky-500/15 text-sky-300"
      }`}
    >
      {regionLabel(region)}
    </span>
  );
}

export function StockIdentity({ stock }: { stock: StockSnapshot }) {
  return (
    <div className="flex items-center gap-3">
      <Logo name={stock.name} src={stock.logoUrl} />
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-white">{stock.name}</span>
          <RegionBadge stock={stock} />
        </div>
        <div className="text-xs text-slate-500">
          {marketLabel(stock.market)} · {stock.code}
        </div>
      </div>
    </div>
  );
}

export function MarketFilterSelect({
  value,
  onChange,
}: {
  value: MarketFilter;
  onChange: (value: MarketFilter) => void;
}) {
  return (
    <label className="lg:col-span-3">
      <span className="mb-2 block text-xs font-medium text-slate-400">시장</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as MarketFilter)}
        className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
      >
        <option value="ALL">전체</option>
        <option value="KR">한국 (코스피·코스닥)</option>
        <option value="US">미국 (나스닥)</option>
        <option value="KOSPI">코스피</option>
        <option value="KOSDAQ">코스닥</option>
        <option value="NASDAQ">나스닥</option>
      </select>
    </label>
  );
}

export function RegionSection({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs tabular-nums text-slate-400">
          {count.toLocaleString("ko-KR")}종목
        </span>
      </div>
      {count === 0 ? <p className="py-10 text-center text-sm text-slate-400">{empty}</p> : children}
    </div>
  );
}

