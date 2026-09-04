/**
 * [INPUT]: 依赖 domain 套图目录、content-language、ImageDropzone、Button/Textarea
 * [OUTPUT]: 对外提供 ListingSetForm，收集原图/平台/卖点/槽位后提交
 * [POS]: components/listing-set 的左栏表单，被 ListingSetWorkspace 挂载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Sparkles, Trash2, UploadCloud } from "lucide-react";

import { ImageDropzone } from "@/components/shared/image-dropzone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { contentLanguageLabels, contentLanguageOptions } from "@/lib/utils/content-language";
import { cn } from "@/lib/utils";
import {
  defaultListingSetGroupCounts,
  defaultListingSetSlotKeys,
  listingSetGroupCatalog,
  listingSetGroupKeys,
  listingSetMarketLabels,
  listingSetMarkets,
  listingSetMaxSlotCount,
  listingSetMaxSourceImages,
  listingSetMinSlotCount,
  platformLabels,
  platformOptions,
  studioAspectRatios,
  type ListingSetGroupKey,
  type ListingSetMarket,
  type ListingSetViralStyle,
  type PlatformOption,
  type StudioAspectRatio,
} from "@/types/domain";

const selectClass =
  "flex h-10 w-full rounded-xl border border-input bg-white px-3 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring dark:bg-white/6 dark:text-slate-100";

export type ListingSetFormValues = {
  files: File[];
  platform: PlatformOption;
  market: ListingSetMarket;
  contentLanguage: (typeof contentLanguageOptions)[number];
  aspectRatio: StudioAspectRatio;
  sellingPoints: string;
  structureMode: "smart" | "custom";
  groupCounts: Record<ListingSetGroupKey, number>;
  analyzeViralStyle: boolean;
  viralStyle: ListingSetViralStyle | null;
  generateListingCopy: boolean;
};

export const emptyListingSetForm = (): ListingSetFormValues => ({
  files: [],
  platform: "douyin_ecommerce",
  market: "cn",
  contentLanguage: "zh-CN",
  aspectRatio: "1:1",
  sellingPoints: "",
  structureMode: "smart",
  groupCounts: { ...defaultListingSetGroupCounts },
  analyzeViralStyle: false,
  viralStyle: null,
  generateListingCopy: true,
});

export function countListingSetSlots(values: ListingSetFormValues) {
  if (values.structureMode === "smart") return defaultListingSetSlotKeys.length;
  return listingSetGroupKeys.reduce((sum, key) => sum + (values.groupCounts[key] ?? 0), 0);
}

function ModeMark({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
        selected ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white dark:border-white/25 dark:bg-transparent",
      )}
      aria-hidden
    >
      {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
    </span>
  );
}

function SwitchKnob({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        checked ? "bg-slate-950" : "bg-slate-300 dark:bg-zinc-600",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[1.35rem]" : "translate-x-0.5",
        )}
      />
    </span>
  );
}

function ExtraToggle(props: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.checked)}
      className="flex w-full items-center justify-between gap-3 rounded-[1.35rem] bg-slate-100 px-4 py-3.5 text-left disabled:opacity-50 dark:bg-white/[0.06]"
    >
      <span className="text-sm font-medium text-slate-900 dark:text-white">{props.label}</span>
      <SwitchKnob checked={props.checked} />
    </button>
  );
}

function FileThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5">
      <div className="aspect-square bg-slate-50 dark:bg-white/5">
        {url ? <img src={url} alt={file.name} className="h-full w-full object-cover" /> : null}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-500 opacity-0 shadow-sm transition group-hover:opacity-100 dark:bg-black/70 dark:text-slate-200"
        aria-label="移除图片"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ListingSetForm(props: {
  values: ListingSetFormValues;
  disabled?: boolean;
  assisting?: boolean;
  viralAssisting?: boolean;
  onChange: (next: ListingSetFormValues) => void;
  onAssist: () => void;
  onViralAssist: () => void;
  onSubmit: () => void;
}) {
  const { values, disabled, assisting, viralAssisting, onChange } = props;
  const slotTotal = countListingSetSlots(values);
  const canSubmit = values.files.length > 0 && slotTotal >= listingSetMinSlotCount && slotTotal <= listingSetMaxSlotCount && !disabled;

  const hint = useMemo(() => {
    if (values.structureMode === "smart") {
      return "AI 会按商品品类在 7 张骨架上微调，主图始终留白底合规位。";
    }
    if (slotTotal < listingSetMinSlotCount) return `至少 ${listingSetMinSlotCount} 张，当前 ${slotTotal} 张。`;
    if (slotTotal > listingSetMaxSlotCount) return `最多 ${listingSetMaxSlotCount} 张，当前 ${slotTotal} 张。`;
    return `将生成 ${slotTotal} 张套图。`;
  }, [values.structureMode, slotTotal]);

  return (
    <form
      className="flex flex-col md:min-h-0 md:flex-1"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) props.onSubmit();
      }}
    >
      <div className="space-y-6 pr-1 md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-slate-800 dark:text-slate-100">商品原图</Label>
            <span className="text-xs text-slate-400">同一产品，最多 {listingSetMaxSourceImages} 张</span>
          </div>
          <ImageDropzone
            multiple
            disabled={disabled}
            captureDocumentDrop
            aria-label="上传商品原图"
            className="flex cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-slate-300 bg-white/60 px-4 py-8 text-center transition hover:bg-slate-50 dark:border-white/15 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
            onFiles={(files) => {
              const merged = [...values.files, ...files].slice(0, listingSetMaxSourceImages);
              onChange({ ...values, files: merged });
            }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-black/30">
              <UploadCloud className="h-4 w-4" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-100">点击或拖拽上传图片</p>
            <p className="mt-1 text-xs text-slate-400">白底主图优先，可补角度与细节</p>
          </ImageDropzone>
          {values.files.length ? (
            <div className="grid grid-cols-3 gap-2">
              {values.files.map((file, index) => (
                <FileThumb
                  key={`${file.name}-${file.lastModified}-${index}`}
                  file={file}
                  onRemove={() => onChange({ ...values, files: values.files.filter((_, item) => item !== index) })}
                />
              ))}
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <Label className="text-sm text-slate-800 dark:text-slate-100">生成设置</Label>
          <div className="grid grid-cols-2 gap-2">
            <select
              className={selectClass}
              value={values.platform}
              disabled={disabled}
              onChange={(event) => onChange({ ...values, platform: event.target.value as PlatformOption })}
            >
              {platformOptions.map((option) => (
                <option key={option} value={option}>
                  {platformLabels[option]}
                </option>
              ))}
            </select>
            <select
              className={selectClass}
              value={values.market}
              disabled={disabled}
              onChange={(event) => onChange({ ...values, market: event.target.value as ListingSetMarket })}
            >
              {listingSetMarkets.map((option) => (
                <option key={option} value={option}>
                  {listingSetMarketLabels[option]}
                </option>
              ))}
            </select>
            <select
              className={selectClass}
              value={values.contentLanguage}
              disabled={disabled}
              onChange={(event) => onChange({ ...values, contentLanguage: event.target.value as ListingSetFormValues["contentLanguage"] })}
            >
              {contentLanguageOptions.map((option) => (
                <option key={option} value={option}>
                  {contentLanguageLabels[option]}
                </option>
              ))}
            </select>
            <select
              className={selectClass}
              value={values.aspectRatio}
              disabled={disabled}
              onChange={(event) => onChange({ ...values, aspectRatio: event.target.value as StudioAspectRatio })}
            >
              {studioAspectRatios.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-sm text-slate-800 dark:text-slate-100">商品卖点 & 要求</Label>
            <Button type="button" variant="outline" size="sm" className="h-8 rounded-full" disabled={disabled || assisting} onClick={props.onAssist}>
              {assisting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
              AI 帮写
            </Button>
          </div>
          <Textarea
            value={values.sellingPoints}
            disabled={disabled}
            onChange={(event) => onChange({ ...values, sellingPoints: event.target.value })}
            className="min-h-[160px] rounded-2xl"
            placeholder={"建议包含以下信息生成更精准：\n1.产品名称\n2.核心卖点\n3.适用人群\n4.期望场景\n5.具体参数"}
          />
        </section>

        <section className="space-y-3">
          <Label className="text-sm text-slate-800 dark:text-slate-100">套图结构配置</Label>
          <div className="space-y-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...values, structureMode: "smart" })}
              className={cn(
                "flex w-full items-start gap-3 rounded-[1.35rem] border px-4 py-3.5 text-left transition",
                values.structureMode === "smart"
                  ? "border-slate-200 bg-white shadow-sm dark:border-white/15 dark:bg-white"
                  : "border-transparent bg-slate-100/90 dark:border-white/10 dark:bg-white/[0.06]",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <ModeMark selected={values.structureMode === "smart"} />
              <span className="min-w-0">
                <span className={cn("block text-sm font-semibold", values.structureMode === "smart" ? "text-slate-950" : "text-slate-800 dark:text-slate-100")}>
                  智能匹配
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">AI 分析商品图，匹配最佳 Listing 套图。</span>
              </span>
            </button>

            <div
              className={cn(
                "rounded-[1.35rem] border px-4 py-3.5 transition",
                values.structureMode === "custom"
                  ? "border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-zinc-900"
                  : "border-transparent bg-slate-100/90 dark:border-white/10 dark:bg-white/[0.06]",
              )}
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange({ ...values, structureMode: "custom" })}
                className="flex w-full items-start gap-3 text-left disabled:opacity-60"
              >
                <ModeMark selected={values.structureMode === "custom"} />
                <span className="min-w-0">
                  <span className={cn("block text-sm font-semibold", values.structureMode === "custom" ? "text-slate-950 dark:text-white" : "text-slate-800 dark:text-slate-100")}>
                    自定义配置
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">可自由调整各类型图片数量，至少选择 7 张。</span>
                </span>
              </button>

              {values.structureMode === "custom" ? (
                <div className="mt-3 space-y-2">
                  {listingSetGroupKeys.map((group) => {
                    const catalog = listingSetGroupCatalog[group];
                    const count = values.groupCounts[group];
                    const min = catalog.minCount;
                    return (
                      <div key={group} className="flex items-center justify-between gap-3 rounded-[1.15rem] bg-white px-4 py-3 dark:bg-zinc-800">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                            {catalog.label}
                            {catalog.aiMatch ? (
                              <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-400/15 dark:text-sky-300">
                                AI 智能匹配
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{catalog.hint}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 rounded-full bg-slate-100 px-2 py-1 text-sm text-slate-600 dark:bg-white/10 dark:text-slate-200">
                          <button
                            type="button"
                            className="h-6 w-6 rounded-full hover:bg-white disabled:opacity-30 dark:hover:bg-white/10"
                            disabled={disabled || count <= min}
                            onClick={() =>
                              onChange({
                                ...values,
                                groupCounts: { ...values.groupCounts, [group]: Math.max(min, count - 1) },
                              })
                            }
                          >
                            −
                          </button>
                          <span className="w-4 text-center tabular-nums text-slate-950 dark:text-white">{count}</span>
                          <button
                            type="button"
                            className="h-6 w-6 rounded-full hover:bg-white disabled:opacity-30 dark:hover:bg-white/10"
                            disabled={disabled || slotTotal >= listingSetMaxSlotCount}
                            onClick={() =>
                              onChange({
                                ...values,
                                groupCounts: { ...values.groupCounts, [group]: count + 1 },
                              })
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
          <p className="text-xs text-slate-400">{hint}</p>
        </section>

        <section className="space-y-3">
          <Label className="text-sm text-slate-800 dark:text-slate-100">附加功能</Label>
          <div className="space-y-2">
            <div className="rounded-[1.35rem] bg-slate-100 px-4 py-3.5 dark:bg-white/[0.06]">
              <button
                type="button"
                role="switch"
                aria-checked={values.analyzeViralStyle}
                disabled={disabled}
                onClick={() => onChange({ ...values, analyzeViralStyle: !values.analyzeViralStyle })}
                className="flex w-full items-center justify-between gap-3 text-left disabled:opacity-50"
              >
                <span className="text-sm font-medium text-slate-900 dark:text-white">爆款风格分析</span>
                <SwitchKnob checked={values.analyzeViralStyle} />
              </button>
              {values.analyzeViralStyle ? (
                <>
                  <button
                    type="button"
                    disabled={disabled || viralAssisting}
                    onClick={props.onViralAssist}
                    className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-medium text-slate-950 shadow-sm disabled:opacity-50 dark:bg-zinc-800 dark:text-white"
                  >
                    {viralAssisting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-sky-500" />}
                    爆款风格分析
                  </button>
                  {values.viralStyle ? (
                    <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{values.viralStyle.summary}</p>
                  ) : null}
                </>
              ) : null}
            </div>
            <ExtraToggle
              label="商品上架文案生成"
              checked={values.generateListingCopy}
              disabled={disabled}
              onChange={(checked) => onChange({ ...values, generateListingCopy: checked })}
            />
          </div>
        </section>
      </div>

      <div className="shrink-0 border-t border-slate-200/80 bg-white/80 pt-4 dark:border-white/10 dark:bg-[#0f0f10]/80">
        <Button type="submit" className="h-12 w-full rounded-2xl" disabled={!canSubmit}>
          {disabled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {disabled ? "正在生成套图…" : values.generateListingCopy ? `一键生成套图与上架文案（${slotTotal}张）` : `一键生成套图（${slotTotal}张）`}
        </Button>
      </div>
    </form>
  );
}
