/**
 * [INPUT]: 依赖 /api/product-swap/*、/api/tasks、ProductSwapForm/Canvas、fileToBase64Payload
 * [OUTPUT]: 对外提供 ProductSwapWorkspace；提交后入队并轮询，直到换品图写回
 * [POS]: components/product-swap 的工作台，被 app/(app)/product-swap/page.tsx 挂载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { ProductSwapCanvas } from "@/components/product-swap/product-swap-canvas";
import { emptyProductSwapForm, ProductSwapForm, type ProductSwapFormValues } from "@/components/product-swap/product-swap-form";
import { Button } from "@/components/ui/button";
import { fileToBase64Payload } from "@/lib/utils/base64-upload";
import { cn } from "@/lib/utils";
import type { ProductSwapProjectSummary, ProductSwapView } from "@/types/domain";

type ApiPayload<T> = {
  success: boolean;
  data?: T;
  error?: { message?: string };
};

type TaskPayload = {
  id: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELED";
  errorMessage?: string | null;
};

async function readApi<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = (await response.json()) as ApiPayload<T>;
  if (!payload.success || payload.data === undefined) {
    throw new Error(payload.error?.message ?? "请求失败");
  }
  return payload.data;
}

async function downloadImage(url: string, fileName: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

export function ProductSwapWorkspace({ initialProjects }: { initialProjects: ProductSwapProjectSummary[] }) {
  const [form, setForm] = useState<ProductSwapFormValues>(emptyProductSwapForm);
  const [projects, setProjects] = useState(initialProjects);
  const [view, setView] = useState<ProductSwapView | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [task, setTask] = useState<TaskPayload | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const generating =
    submitting ||
    task?.status === "PENDING" ||
    task?.status === "RUNNING" ||
    (!task && (view?.latestTaskStatus === "PENDING" || view?.latestTaskStatus === "RUNNING"));

  async function refreshList() {
    const next = await readApi<ProductSwapProjectSummary[]>("/api/product-swap/projects");
    setProjects(next);
  }

  async function openProject(id: string) {
    const next = await readApi<ProductSwapView>(`/api/product-swap/projects/${id}`);
    setView(next);
    setTask(null);
    setTaskId(next.latestTaskId);
    setSubmitting(false);
  }

  useEffect(() => {
    if (!taskId) return;
    if (task && task.id === taskId && (task.status === "SUCCESS" || task.status === "FAILED" || task.status === "CANCELED")) return;
    let cancelled = false;

    async function tick() {
      try {
        const next = await readApi<TaskPayload>(`/api/tasks/${taskId}`, { cache: "no-store" });
        if (cancelled) return;
        setTask(next);
        if (view?.id) {
          const latest = await readApi<ProductSwapView>(`/api/product-swap/projects/${view.id}`);
          if (!cancelled) setView(latest);
        }
        if (next.status === "SUCCESS" || next.status === "FAILED" || next.status === "CANCELED") {
          setSubmitting(false);
          await refreshList();
          if (next.status === "FAILED") {
            toast.error(next.errorMessage ?? "换品生成失败");
          }
        }
      } catch {
        // 轮询失败时下一拍再试
      }
    }

    const timer = window.setInterval(() => void tick(), 2000);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [taskId, view?.id, task?.status]);

  async function handleSubmit() {
    if (!form.sceneFile || !form.productFile) {
      toast.error("请上传场景实拍和本品图");
      return;
    }
    setSubmitting(true);
    setTask(null);
    try {
      const [sceneImage, productImage] = await Promise.all([
        fileToBase64Payload(form.sceneFile),
        fileToBase64Payload(form.productFile),
      ]);
      const result = await readApi<{ taskId: string; projectId: string }>("/api/product-swap/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneImage,
          productImage,
          aspectRatio: form.aspectRatio,
          notes: form.notes,
        }),
      });
      setTaskId(result.taskId);
      const next = await readApi<ProductSwapView>(`/api/product-swap/projects/${result.projectId}`);
      setView(next);
      toast.success("已开始换品");
      await refreshList();
    } catch (error) {
      setSubmitting(false);
      toast.error(error instanceof Error ? error.message : "换品任务创建失败");
    }
  }

  async function handleRegenerate() {
    if (!view) return;
    setSubmitting(true);
    setTask(null);
    try {
      const result = await readApi<{ taskId: string; projectId: string }>(`/api/product-swap/projects/${view.id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      setTaskId(result.taskId);
      toast.success("正在重新生成");
      const latest = await readApi<ProductSwapView>(`/api/product-swap/projects/${view.id}`);
      setView(latest);
    } catch (error) {
      setSubmitting(false);
      toast.error(error instanceof Error ? error.message : "重新生成失败");
    }
  }

  const recent = useMemo(() => projects.slice(0, 8), [projects]);

  return (
    <div className="flex min-h-0 flex-col gap-4 md:h-[calc(100dvh-10.5rem)]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">实拍换品</h1>
          <p className="mt-1 text-sm text-slate-500">把达人实拍里的货换成你的，场面不动。</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          onClick={() => {
            setForm(emptyProductSwapForm());
            setView(null);
            setTask(null);
            setTaskId(null);
            setSubmitting(false);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          新建任务
        </Button>
      </div>

      {recent.length ? (
        <div className="flex shrink-0 gap-2 overflow-x-auto pb-1">
          {recent.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void openProject(item.id)}
              className={cn(
                "flex min-w-[9.5rem] items-center gap-2 rounded-2xl border px-2 py-1.5 text-left text-xs transition",
                view?.id === item.id
                  ? "border-slate-900 bg-white shadow-sm dark:border-white/40 dark:bg-white/10"
                  : "border-slate-200 bg-white/70 hover:bg-white dark:border-white/10 dark:bg-white/5",
              )}
            >
              <span className="h-9 w-9 overflow-hidden rounded-xl bg-slate-100 dark:bg-white/10">
                {item.coverImageUrl ? <img src={item.coverImageUrl} alt="" className="h-full w-full object-cover" /> : null}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-800 dark:text-slate-100">{item.name}</span>
                <span className="text-slate-400">
                  {item.latestTaskStatus === "SUCCESS" ? "已完成" : item.latestTaskStatus === "FAILED" ? "失败" : "生成中"}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="-mx-5 grid rounded-[1.6rem] border border-slate-200/80 bg-white/55 dark:border-white/10 dark:bg-black/20 md:-mx-8 md:min-h-0 md:flex-1 md:grid-cols-[22.5rem_minmax(0,1fr)] md:overflow-hidden">
        <aside className="flex flex-col border-b border-slate-200/80 p-5 dark:border-white/10 md:h-full md:min-h-0 md:overflow-hidden md:border-b-0 md:border-r">
          <ProductSwapForm values={form} disabled={generating} onChange={setForm} onSubmit={() => void handleSubmit()} />
        </aside>
        <section className="min-w-0 bg-slate-50/70 p-5 dark:bg-white/[0.02] md:min-h-0 md:overflow-y-auto md:p-8">
          <ProductSwapCanvas
            view={view}
            generating={generating}
            onOpen={setLightbox}
            onDownload={(url, name) => void downloadImage(url, name)}
            onRegenerate={() => void handleRegenerate()}
          />
        </section>
      </div>

      {lightbox ? (
        <button
          type="button"
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-6"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="换品预览" className="max-h-full max-w-full rounded-3xl object-contain" />
        </button>
      ) : null}
    </div>
  );
}
