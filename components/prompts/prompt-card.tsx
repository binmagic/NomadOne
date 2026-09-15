/**
 * [INPUT]: 依赖 PromptTemplateView、Button
 * [OUTPUT]: 对外提供 PromptCard，展示效果图、标题、提示词摘要与始终可见的 使用/编辑/删除
 * [POS]: components/prompts 的单卡，被 PromptLibrary 铺成网格
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

"use client";

import { Pencil, Trash2, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PromptTemplateView } from "@/types/domain";

export function PromptCard({
  template,
  onUse,
  onEdit,
  onDelete,
}: {
  template: PromptTemplateView;
  onUse: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-[28px] border border-white/70 bg-white/80 shadow-soft dark:border-white/10 dark:bg-black/30">
      <button type="button" className="block w-full" onClick={onUse} aria-label={`使用 ${template.title}`}>
        <div className="aspect-square overflow-hidden bg-slate-100 dark:bg-white/5">
          {template.previewUrl ? (
            <img src={template.previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-400">
              <Wand2 className="h-8 w-8" />
            </div>
          )}
        </div>
      </button>
      <div className="space-y-3 p-4">
        <div className="space-y-1">
          <h2 className="truncate text-base font-semibold tracking-tight text-slate-950 dark:text-white">{template.title}</h2>
          <p className="line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{template.prompt}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" className="rounded-xl" onClick={onUse}>
            使用
          </Button>
          <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={onEdit}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            编辑
          </Button>
          <Button type="button" size="sm" variant="ghost" className="rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-300 dark:hover:bg-rose-500/10" onClick={onDelete}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            删除
          </Button>
        </div>
      </div>
    </article>
  );
}
