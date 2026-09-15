/**
 * [INPUT]: 依赖 /api/prompts、PageHeader/ConfirmDialog、PromptCard/PromptFormDialog
 * [OUTPUT]: 对外提供 PromptLibrary；卡片网格增删改，使用则跳到对话生图并带 template 查询
 * [POS]: components/prompts 的工作台，被 app/(app)/prompts/page.tsx 挂载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { PromptCard } from "@/components/prompts/prompt-card";
import { PromptFormDialog, type PromptFormValues } from "@/components/prompts/prompt-form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
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

export function PromptLibrary({ initialTemplates }: { initialTemplates: PromptTemplateView[] }) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<PromptTemplateView | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PromptTemplateView | null>(null);
  const [deleting, setDeleting] = useState(false);

  function openCreate() {
    setFormMode("create");
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(template: PromptTemplateView) {
    setFormMode("edit");
    setEditing(template);
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSave(values: PromptFormValues) {
    setSaving(true);
    setFormError(null);
    try {
      if (formMode === "create") {
        const created = await readApi<PromptTemplateView>("/api/prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        setTemplates((current) => [created, ...current.filter((item) => item.id !== created.id)]);
        toast.success("提示词已保存");
      } else if (editing) {
        const updated = await readApi<PromptTemplateView>(`/api/prompts/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        setTemplates((current) => [updated, ...current.filter((item) => item.id !== updated.id)]);
        toast.success("提示词已更新");
      }
      setFormOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await readApi(`/api/prompts/${pendingDelete.id}`, { method: "DELETE" });
      setTemplates((current) => current.filter((item) => item.id !== pendingDelete.id));
      setPendingDelete(null);
      toast.success("提示词已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="提示词"
        title="效果图卡片，点进对话就用"
        description="工作区共用一套卡片，谁都可以新建、改、删。卡片图是效果示意，不会当作参考图发出。"
        actions={
          <Button type="button" className="rounded-2xl" onClick={openCreate}>
            <Sparkles className="mr-2 h-4 w-4" />
            新建
          </Button>
        }
      />

      {templates.length === 0 ? (
        <div className="flex min-h-[42vh] flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-white/70 bg-white/55 px-6 text-center shadow-soft dark:border-white/10 dark:bg-black/25">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
            <Sparkles className="h-6 w-6 text-slate-700 dark:text-slate-200" />
          </div>
          <p className="text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">还没有提示词</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">先存一张效果图和说明，工作区里的人都能在对话生图里选用。</p>
          <Button type="button" className="mt-5 rounded-2xl" onClick={openCreate}>
            新建提示词
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <PromptCard
              key={template.id}
              template={template}
              onUse={() => router.push(`/studio?template=${template.id}`)}
              onEdit={() => openEdit(template)}
              onDelete={() => setPendingDelete(template)}
            />
          ))}
        </div>
      )}

      <PromptFormDialog
        open={formOpen}
        mode={formMode}
        loading={saving}
        initial={editing}
        error={formError}
        onCancel={() => setFormOpen(false)}
        onSubmit={(values) => void handleSave(values)}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="删除这张提示词？"
        description="效果图会从本地存储清掉，不能恢复。"
        confirmText="删除"
        destructive
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
