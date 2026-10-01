"use client";

import { assetUrl } from "@/lib/paths";
import type { ScanStatus, UniversePayload } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

const STATIC_HOST = process.env.NEXT_PUBLIC_STATIC === "true";

async function loadStaticUniverse(): Promise<UniversePayload> {
  const response = await fetch(assetUrl("/universe.json"), { cache: "no-store" });
  if (!response.ok) throw new Error("저장된 시세 스냅샷을 불러오지 못했습니다.");
  return (await response.json()) as UniversePayload;
}

export function useUniverse() {
  const [status, setStatus] = useState<ScanStatus>({ status: "idle" });
  const [data, setData] = useState<UniversePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const readStatus = useCallback(async (): Promise<ScanStatus> => {
    const response = await fetch(assetUrl("/api/scan"), { cache: "no-store" });
    if (!response.ok) throw new Error("스캔 상태를 불러오지 못했습니다.");
    return (await response.json()) as ScanStatus;
  }, []);

  const startScan = useCallback(
    async (refresh: boolean) => {
      setError(null);
      if (STATIC_HOST) {
        const snapshot = await loadStaticUniverse();
        setData(snapshot);
        setStatus({ status: "done", data: snapshot });
        if (refresh) {
          setError("GitHub Pages에서는 실시간 스캔 대신 저장된 스냅샷을 사용합니다.");
        }
        return;
      }

      try {
        const started = await fetch(assetUrl("/api/scan"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh }),
        });
        if (!started.ok) throw new Error("스캔을 시작하지 못했습니다.");
        setStatus((await started.json()) as ScanStatus);

        for (let i = 0; i < 900; i += 1) {
          const next = await readStatus();
          setStatus(next);
          if (next.status === "done") {
            setData(next.data);
            return;
          }
          if (next.status === "error") {
            setError(next.message);
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 700));
        }
        setError("스캔 시간이 너무 오래 걸립니다. 다시 시도해 주세요.");
      } catch (err) {
        const snapshot = await loadStaticUniverse();
        setData(snapshot);
        setStatus({ status: "done", data: snapshot });
        if (refresh) {
          setError(err instanceof Error ? err.message : "스캔을 시작하지 못했습니다.");
        }
      }
    },
    [readStatus],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (STATIC_HOST) {
          await startScan(false);
          return;
        }
        const current = await readStatus();
        if (cancelled) return;
        setStatus(current);
        if (current.status === "done") {
          setData(current.data);
          return;
        }
        await startScan(false);
      } catch (err) {
        if (cancelled) return;
        try {
          await startScan(false);
        } catch {
          setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [readStatus, startScan]);

  const running = status.status === "running";
  const progress =
    status.status === "running" && status.total > 0
      ? Math.round((status.done / status.total) * 100)
      : 0;

  return {
    status,
    data,
    error,
    setError,
    startScan,
    running,
    progress,
    staticHost: STATIC_HOST,
  };
}
