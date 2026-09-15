/**
 * [INPUT]: 依赖 /api/prompts、PromptTemplateView
 * [OUTPUT]: 对外提供 StudioPromptPicker；打开时拉取卡片，点选只回传 prompt 文案
 * [POS]: components/studio 的只读选用器，被 StudioWorkspace 挂在 composer 旁
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PromptTemplateView } from "@/types/domain";

type ApiPayload<T> = {
  success: boolean;
  data?: T;
  error?: { message?: string };
};

async function readApi<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = (await response.json()) as ApiPayload<T>;
  if (!payload.success || payload.data === undefined) {
    throw new Error(payload.error?.message ?? "请求失败");
  }
  return payload.data;
}

export function StudioPromptPicker({ onApply }: { onApply: (prompt: string) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<PromptTemplateView[]>([]);

  async function openPicker() {
    setOpen(true);
    setLoading(true);
    try {
      const list = await readApi<PromptTemplateView[]>("/api/prompts");
      setTemplates(list);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "无法加载提示词");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="h-11 rounded-2xl px-3" onClick={() => void openPicker()}>
        <Sparkles className="h-4 w-4" />
        <span className="ml-1.5 hidden sm:inline">模板</span>
      </Button>

      {open ? (
        <div className="fixed inset-0 z-[115] flex justify-end">
          <button type="button" aria-label="关闭提示词面板" className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="relative z-[116] flex h-full w-full max-w-sm flex-col border-l border-white/70 bg-white/90 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-black/70">
            <div className="flex items-start justify-between gap-3 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-950 dark:text-white">选用提示词</p>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">选用只填入说明文字，效果图不会当作参考图发送。</p>
              </div>
              <button type="button" className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4">
              {loading ? (
                <p className="flex items-center justify-center py-16 text-sm text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在加载
                </p>
              ) : templates.length === 0 ? (
                <p className="px-2 py-16 text-center text-sm leading-6 text-slate-500">还没有提示词。先到管理页存一张效果图和说明。</p>
              ) : (
                templates.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl border border-black/5 bg-white/80 p-2 text-left transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                    onClick={() => {
                      onApply(item.prompt);
                      setOpen(false);
                    }}
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-white/5">
                      {item.previewUrl ? <img src={item.previewUrl} alt="" className="h-full w-full object-cover" /> : <Sparkles className="m-auto h-4 w-4 text-slate-400" />}
                    </div>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-950 dark:text-white">{item.title}</span>
                      <span className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400">{item.prompt}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-black/5 px-5 py-3 dark:border-white/10">
              <Link href="/prompts" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full rounded-xl")}>
                管理提示词
              </Link>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
