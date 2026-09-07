/**
 * [INPUT]: 依赖 ProductSwapView、lucide
 * [OUTPUT]: 对外提供 ProductSwapCanvas：空态、生成中、结果图与下载/重绘
 * [POS]: components/product-swap 的右栏画布，被 ProductSwapWorkspace 挂载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

"use client";

import { Download, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProductSwapView, StudioAspectRatio } from "@/types/domain";

function aspectClass(ratio: StudioAspectRatio | string | null | undefined) {
  if (ratio === "3:4") return "aspect-[3/4]";
  if (ratio === "9:16") return "aspect-[9/16]";
  return "aspect-square";
}

function EmptyPreview() {
  return (
    <div className="mx-auto flex min-h-[32rem] max-w-xl flex-col items-center justify-center px-4 text-center">
      <h2 className="text-4xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white md:text-5xl">实拍换品</h2>
      <p className="mt-4 max-w-md text-sm leading-7 text-slate-500 dark:text-slate-400">
        把达人实拍里的竞品换成自家货。人、手、房间、光线原样留下，不重新布景。
      </p>
      <div className="mt-10 grid w-full max-w-lg grid-cols-2 gap-3">
        <div className="rounded-[1.4rem] border border-slate-200 bg-white p-4 text-left shadow-sm dark:border-white/10 dark:bg-white/5">
          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-white/10 dark:text-slate-300">
            01 场景实拍
          </span>
          <p className="mt-3 text-xs leading-5 text-slate-400">达人/玩家原图当底板</p>
        </div>
        <div className="rounded-[1.4rem] border border-slate-200 bg-white p-4 text-left shadow-sm dark:border-white/10 dark:bg-white/5">
          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-white/10 dark:text-slate-300">
            02 本品图
          </span>
          <p className="mt-3 text-xs leading-5 text-slate-400">只替换被手持或展示的那个货</p>
        </div>
      </div>
    </div>
  );
}

export function ProductSwapCanvas(props: {
  view: ProductSwapView | null;
  generating: boolean;
  onOpen: (url: string) => void;
  onDownload: (url: string, name: string) => void;
  onRegenerate?: () => void;
}) {
  if (!props.view && !props.generating) {
    return <EmptyPreview />;
  }

  const ratio = props.view?.aspectRatio ?? "3:4";
  const imageUrl = props.view?.resultImageUrl;
  const failed = props.view?.latestTaskStatus === "FAILED";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
            {props.view?.name ?? "正在换品"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {props.generating ? "出图在服务器完成，关掉页面再回来也能接着看。" : "只换产品，场面不动。"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {imageUrl ? (
            <Button type="button" variant="outline" className="rounded-full" onClick={() => props.onDownload(imageUrl, "product-swap.png")}>
              <Download className="mr-2 h-4 w-4" />
              下载
            </Button>
          ) : null}
          {props.view && props.onRegenerate ? (
            <Button type="button" variant="outline" className="rounded-full" disabled={props.generating} onClick={props.onRegenerate}>
              <RefreshCw className="mr-2 h-4 w-4" />
              重新生成
            </Button>
          ) : null}
        </div>
      </div>

      <article className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
        <button
          type="button"
          className={cn("relative mx-auto block w-full max-w-xl bg-slate-50 dark:bg-white/5", aspectClass(ratio))}
          onClick={() => imageUrl && props.onOpen(imageUrl)}
          disabled={!imageUrl}
        >
          {imageUrl ? (
            <img src={imageUrl} alt={props.view?.name ?? "换品结果"} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-300">
              {props.generating ? <Loader2 className="h-8 w-8 animate-spin" /> : failed ? "失败" : "等待出图"}
            </div>
          )}
        </button>
        {failed && props.view?.errorMessage ? (
          <p className="px-4 py-3 text-sm leading-6 text-rose-500">{props.view.errorMessage}</p>
        ) : null}
      </article>
    </div>
  );
}
