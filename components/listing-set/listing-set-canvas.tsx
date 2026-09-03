/**
 * [INPUT]: 依赖 ListingSetView、套图槽位目录、lucide
 * [OUTPUT]: 对外提供 ListingSetCanvas：空态结构示意、生成进度、结果墙与上架文案
 * [POS]: components/listing-set 的右栏画布，被 ListingSetWorkspace 挂载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

"use client";

import { Copy, Download, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  defaultListingSetSlotKeys,
  listingSetSlotCatalog,
  type ListingSetCopy,
  type ListingSetSlotKey,
  type ListingSetSlotView,
  type ListingSetView,
  type ListingSetViralStyle,
} from "@/types/domain";

type ProgressItem = {
  key: string;
  slotKey: ListingSetSlotKey;
  title: string;
  state: "pending" | "running" | "done" | "failed";
  message: string;
  imageUrl?: string | null;
};

const previewSlots: Array<{ key: ListingSetSlotKey; index: string; span: string }> = [
  { key: "hero_white", index: "01", span: "row-span-2" },
  { key: "scene", index: "02", span: "" },
  { key: "model", index: "03", span: "" },
  { key: "detail", index: "04", span: "" },
  { key: "selling", index: "05", span: "" },
];

function aspectClass(ratio: string | null | undefined) {
  if (ratio === "3:4") return "aspect-[3/4]";
  if (ratio === "9:16") return "aspect-[9/16]";
  return "aspect-square";
}

function EmptyPreview() {
  return (
    <div className="mx-auto flex min-h-[32rem] max-w-3xl flex-col items-center justify-center px-4 text-center">
      <h2 className="text-4xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white md:text-5xl">AI 商品套图</h2>
      <p className="mt-4 max-w-xl text-sm leading-7 text-slate-500 dark:text-slate-400">
        上传商品图，按平台主图规范一次出齐白底主图、场景、模特、细节与卖点。默认 7 张，主图始终无字。
      </p>
      <div className="mt-10 grid w-full max-w-2xl grid-cols-3 grid-rows-2 gap-3">
        {previewSlots.map((slot) => (
          <div
            key={slot.key}
            className={cn(
              "relative overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white p-4 text-left shadow-sm dark:border-white/10 dark:bg-white/5",
              slot.span,
              slot.key === "hero_white" ? "col-span-1 min-h-[16rem]" : "min-h-[7.5rem]",
            )}
          >
            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-white/10 dark:text-slate-300">
              {slot.index} {listingSetSlotCatalog[slot.key].label}
            </span>
            <p className="mt-3 text-xs leading-5 text-slate-400">{listingSetSlotCatalog[slot.key].hint}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-400">另外两张默认补规格参数与使用场景，可在左侧改成自定义结构。</p>
    </div>
  );
}

function SlotCard(props: {
  slot: ListingSetSlotView | { key: string; slotKey: ListingSetSlotKey; label: string; title: string; status: string; imageUrl: string | null; errorMessage?: string | null };
  aspectRatio: string;
  index: number;
  busy?: boolean;
  onOpen?: (url: string) => void;
  onDownload?: (url: string, name: string) => void;
  onRegenerate?: () => void;
}) {
  const imageUrl = props.slot.imageUrl;
  const failed = props.slot.status === "failed" || props.slot.status === "FAILED";
  const running = props.busy || props.slot.status === "generating" || props.slot.status === "queued";

  return (
    <article className="overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
      <button
        type="button"
        className={cn("relative block w-full bg-slate-50 dark:bg-white/5", aspectClass(props.aspectRatio))}
        onClick={() => imageUrl && props.onOpen?.(imageUrl)}
        disabled={!imageUrl}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={props.slot.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            {running ? <Loader2 className="h-6 w-6 animate-spin" /> : failed ? "失败" : "等待出图"}
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[11px] text-slate-700 shadow-sm dark:bg-black/70 dark:text-slate-100">
          {String(props.index + 1).padStart(2, "0")} {props.slot.label}
        </span>
      </button>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <p className="truncate text-xs text-slate-500">{props.slot.title}</p>
        <div className="flex items-center gap-1">
          {imageUrl ? (
            <button
              type="button"
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10"
              onClick={() => props.onDownload?.(imageUrl, `listing-${props.index + 1}.png`)}
              aria-label="下载"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {props.onRegenerate ? (
            <button
              type="button"
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10"
              onClick={props.onRegenerate}
              aria-label="重绘"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      {failed && "errorMessage" in props.slot && props.slot.errorMessage ? (
        <p className="px-3 pb-3 text-[11px] leading-4 text-rose-500">{props.slot.errorMessage}</p>
      ) : null}
    </article>
  );
}

function ViralStylePanel({ style }: { style: ListingSetViralStyle }) {
  return (
    <section className="rounded-[1.6rem] border border-slate-200 bg-white/80 p-5 dark:border-white/10 dark:bg-white/5">
      <p className="text-xs text-slate-400">爆款风格</p>
      <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{style.summary}</p>
      <p className="mt-3 text-xs text-slate-500">色调：{style.colorMood}</p>
      {style.visualTropes.length ? (
        <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
          {style.visualTropes.map((item) => (
            <li key={item}>· {item}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function CopyPanel({ copy, onCopy }: { copy: ListingSetCopy; onCopy: () => void }) {
  return (
    <section className="rounded-[1.6rem] border border-slate-200 bg-white/80 p-5 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400">上架文案</p>
          <h3 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">{copy.listingTitle}</h3>
        </div>
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onCopy}>
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          复制
        </Button>
      </div>
      <ul className="mt-4 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
        {copy.sellingPoints.map((item) => (
          <li key={item}>· {item}</li>
        ))}
      </ul>
      <p className="mt-4 text-sm leading-6 text-slate-500 dark:text-slate-400">{copy.description}</p>
      {copy.keywords.length ? <p className="mt-3 text-xs text-slate-400">{copy.keywords.join(" / ")}</p> : null}
    </section>
  );
}

export function ListingSetCanvas(props: {
  view: ListingSetView | null;
  progress: ProgressItem[];
  listingCopy: ListingSetCopy | null;
  viralStyle: ListingSetViralStyle | null;
  generating: boolean;
  onOpen: (url: string) => void;
  onDownload: (url: string, name: string) => void;
  onDownloadAll: () => void;
  onCopy: () => void;
  onRegenerate?: (sectionId: string) => void;
}) {
  const slotsFromView = props.view?.slots ?? [];
  const slots =
    slotsFromView.length > 0
      ? slotsFromView
      : props.progress.length > 0
        ? props.progress.map((item, index) => ({
            key: item.key || `${item.slotKey}_${index}`,
            slotKey: item.slotKey,
            sectionId: null,
            order: index,
            label: listingSetSlotCatalog[item.slotKey]?.label ?? item.title,
            title: item.title,
            goal: item.message,
            status: item.state === "done" ? "success" : item.state === "running" ? "generating" : item.state === "failed" ? "failed" : "queued",
            imageUrl: item.imageUrl ?? null,
            errorMessage: item.state === "failed" ? item.message : null,
          }))
        : [];

  if (!props.view && !props.generating && slots.length === 0) {
    return <EmptyPreview />;
  }

  const copy = props.view?.listingCopy ?? props.listingCopy;
  const viralStyle = props.view?.viralStyle ?? props.viralStyle;
  const ratio = props.view?.aspectRatio ?? "1:1";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">{props.view?.name ?? "正在生成套图"}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {props.generating ? "出图在服务器完成，关掉页面再回来也能接着看。" : `共 ${slots.length || defaultListingSetSlotKeys.length} 张 Listing 图`}
          </p>
        </div>
        {slots.some((slot) => slot.imageUrl) ? (
          <Button type="button" variant="outline" className="rounded-full" onClick={props.onDownloadAll}>
            <Download className="mr-2 h-4 w-4" />
            下载全部
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {slots.map((slot, index) => (
          <SlotCard
            key={slot.key}
            slot={slot}
            index={index}
            aspectRatio={ratio}
            busy={props.generating && (slot.status === "generating" || slot.status === "queued")}
            onOpen={props.onOpen}
            onDownload={props.onDownload}
            onRegenerate={slot.sectionId && props.onRegenerate ? () => props.onRegenerate?.(slot.sectionId as string) : undefined}
          />
        ))}
      </div>

      {viralStyle ? <ViralStylePanel style={viralStyle} /> : null}
      {copy ? <CopyPanel copy={copy} onCopy={props.onCopy} /> : null}
    </div>
  );
}
