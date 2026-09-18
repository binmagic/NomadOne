/**
 * [INPUT]: 依赖 /api/forbidden-words、PageHeader/ConfirmDialog、sonner
 * [OUTPUT]: 对外提供 ForbiddenWordLibrary；工作区共用违禁词增删改，支持换行/逗号批量添加
 * [POS]: components/forbidden-words 的工作台，被 app/(app)/forbidden-words/page.tsx 挂载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

"use client";

import { useMemo, useState } from "react";
import { Ban, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ForbiddenWordView } from "@/types/domain";

type ApiPayload<T> = {
  success: boolean;
  data?: T;
  error?: { message?: string };
};

function splitWords(raw: string) {
  return raw
    .split(/[,，\n]+/)
    .map((item) => item.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

async function readApi<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = (await response.json()) as ApiPayload<T>;
  if (!payload.success || payload.data === undefined) {
    throw new Error(payload.error?.message ?? "请求失败");
  }
  return payload.data;
}

export function ForbiddenWordLibrary({ initialWords }: { initialWords: ForbiddenWordView[] }) {
  const [words, setWords] = useState(initialWords);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ForbiddenWordView | null>(null);
  const [deleting, setDeleting] = useState(false);

  const parsedDraft = useMemo(() => splitWords(draft), [draft]);

  async function handleCreate() {
    const nextWords = splitWords(draft);
    if (nextWords.length === 0) {
      toast.error("请填写违禁词");
      return;
    }

    setSaving(true);
    try {
      const result = await readApi<{ created: ForbiddenWordView[]; skipped: string[] }>("/api/forbidden-words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: nextWords }),
      });
      setWords((current) => [...result.created, ...current.filter((item) => !result.created.some((row) => row.id === item.id))]);
      setDraft("");
      if (result.skipped.length > 0) {
        toast.success(`已添加 ${result.created.length} 个，跳过 ${result.skipped.length} 个重复`);
      } else {
        toast.success(result.created.length > 1 ? `已添加 ${result.created.length} 个违禁词` : "违禁词已添加");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "添加失败");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: ForbiddenWordView) {
    setEditingId(item.id);
    setEditingValue(item.word);
  }

  async function handleUpdate(id: string) {
    const next = editingValue.trim().replace(/\s+/g, " ");
    if (!next) {
      toast.error("请填写违禁词");
      return;
    }

    setEditSaving(true);
    try {
      const updated = await readApi<ForbiddenWordView>(`/api/forbidden-words/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: next }),
      });
      setWords((current) => [updated, ...current.filter((item) => item.id !== updated.id)]);
      setEditingId(null);
      toast.success("违禁词已更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新失败");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await readApi(`/api/forbidden-words/${pendingDelete.id}`, { method: "DELETE" });
      setWords((current) => current.filter((item) => item.id !== pendingDelete.id));
      setPendingDelete(null);
      toast.success("违禁词已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="内容合规"
        title="违禁词"
        description="工作区共用一份名单。生图时会写入模型约束，图内不要出现这些词，即使提示词或参考海报里有。"
      />

      <div className="rounded-[1.75rem] border border-white/70 bg-white/70 p-5 shadow-soft dark:border-white/10 dark:bg-black/25">
        <label className="text-sm font-medium text-slate-900 dark:text-white">添加违禁词</label>
        <p className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-400">
          一行一个，也可用逗号分隔。已存在的会自动跳过。
        </p>
        <div className="mt-3 space-y-3">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={"立即购买\n假一赔十\n全网最低"}
            disabled={saving}
            className="min-h-[120px] rounded-2xl"
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void handleCreate();
              }
            }}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-400">{parsedDraft.length > 0 ? `将添加 ${parsedDraft.length} 个` : "⌘/Ctrl + Enter 快速添加"}</p>
            <Button type="button" className="rounded-2xl" disabled={saving} onClick={() => void handleCreate()}>
              <Plus className="mr-2 h-4 w-4" />
              {saving ? "添加中…" : "添加"}
            </Button>
          </div>
        </div>
      </div>

      {words.length === 0 ? (
        <div className="flex min-h-[32vh] flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-white/70 bg-white/55 px-6 text-center shadow-soft dark:border-white/10 dark:bg-black/25">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
            <Ban className="h-6 w-6 text-slate-700 dark:text-slate-200" />
          </div>
          <p className="text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">还没有违禁词</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
            加上之后，对话生图、详情页、套图、换品和小红书出图都会避开这些字。
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="px-1 text-xs text-slate-400">共 {words.length} 个</p>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/80 shadow-soft dark:divide-white/5 dark:border-white/10 dark:bg-black/25">
            {words.map((item) => {
              const isEditing = editingId === item.id;
              return (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  {isEditing ? (
                    <Input
                      value={editingValue}
                      autoFocus
                      disabled={editSaving}
                      onChange={(event) => setEditingValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleUpdate(item.id);
                        }
                        if (event.key === "Escape") {
                          setEditingId(null);
                        }
                      }}
                      className="h-9 flex-1 rounded-xl"
                    />
                  ) : (
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 dark:text-white">{item.word}</p>
                  )}
                  <div className="flex shrink-0 items-center gap-1">
                    {isEditing ? (
                      <>
                        <Button type="button" size="sm" className="rounded-xl" disabled={editSaving} onClick={() => void handleUpdate(item.id)}>
                          保存
                        </Button>
                        <Button type="button" size="sm" variant="ghost" disabled={editSaving} onClick={() => setEditingId(null)}>
                          取消
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(item)} aria-label="编辑">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setPendingDelete(item)} aria-label="删除">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="删除这个违禁词？"
        description="删除后，之后的生图不再拦截这个词。已经生成的图不会改。"
        confirmText="删除"
        destructive
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
