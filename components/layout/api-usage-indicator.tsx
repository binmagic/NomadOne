/**
 * [INPUT]: 依赖 /api/monitor/usage 的 24h 汇总
 * [OUTPUT]: 对外提供 ApiUsageIndicator，顶栏用量胶囊
 * [POS]: layout 的监控入口附属指示器，嵌在 AppShell 的 API 监控按钮内，暗色必须比父按钮更实，避免 white/8 叠 black/30 糊掉
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

type UsageSummary = {
  totalRequests: number;
  imageRequests: number;
  spendingLimitedRequests: number;
  failedRequests: number;
  actualCostUsd: number;
  costSamples: number;
};

export function ApiUsageIndicator({ className }: { className?: string }) {
  const [summary, setSummary] = useState<UsageSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/monitor/usage?hours=24&limit=8", { cache: "no-store" });
        const payload = await response.json();
        if (!cancelled && payload.success) {
          setSummary(payload.data);
        }
      } catch {
        if (!cancelled) {
          setSummary(null);
        }
      }
    }

    load();
    const timer = window.setInterval(load, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const label = summary
    ? summary.costSamples > 0
      ? `24h $${summary.actualCostUsd.toFixed(4)}`
      : `24h ${summary.totalRequests} 次`
    : "24h --";

  const alerting = Boolean(summary && (summary.spendingLimitedRequests > 0 || summary.failedRequests > 0));
  const Icon = alerting ? AlertTriangle : Activity;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium",
          alerting
            ? "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/20 dark:text-amber-100"
            : "border-slate-200/80 bg-slate-100 text-slate-700 dark:border-white/20 dark:bg-zinc-800 dark:text-white",
        )}
      >
        <Icon className="mr-1.5 h-3.5 w-3.5" />
        {label}
      </span>
    </span>
  );
}
