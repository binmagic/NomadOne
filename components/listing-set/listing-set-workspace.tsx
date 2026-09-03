/**
 * [INPUT]: 依赖 /api/listing-set/*、/api/tasks、ListingSetForm/Canvas、fileToBase64Payload
 * [OUTPUT]: 对外提供 ListingSetWorkspace；提交后入队并轮询，直到套图与文案写回
 * [POS]: components/listing-set 的工作台，被 app/(app)/listing-set/page.tsx 挂载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { ListingSetCanvas } from "@/components/listing-set/listing-set-canvas";
import { emptyListingSetForm, ListingSetForm, type ListingSetFormValues } from "@/components/listing-set/listing-set-form";
import { Button } from "@/components/ui/button";
import { fileToBase64Payload } from "@/lib/utils/base64-upload";
import { cn } from "@/lib/utils";
import type { ListingSetCopy, ListingSetProjectSummary, ListingSetSlotKey, ListingSetView, ListingSetViralStyle } from "@/types/domain";

type ApiPayload<T> = {
  success: boolean;
  data?: T;
  error?: { message?: string };
};

type TaskPayload = {
  id: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELED";
  errorMessage?: string | null;
  outputPayload?: {
    items?: Array<{
      key: string;
      slotKey: ListingSetSlotKey;
      title: string;
      state: "pending" | "running" | "done" | "failed";
      message: string;
      imageUrl?: string | null;
    }>;
    listingCopy?: ListingSetCopy | null;
    viralStyle?: ListingSetViralStyle | null;
  } | null;
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

export function ListingSetWorkspace({ initialProjects }: { initialProjects: ListingSetProjectSummary[] }) {
  const [form, setForm] = useState<ListingSetFormValues>(emptyListingSetForm);
  const [projects, setProjects] = useState(initialProjects);
  const [view, setView] = useState<ListingSetView | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [task, setTask] = useState<TaskPayload | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [assisting, setAssisting] = useState(false);
  const [viralAssisting, setViralAssisting] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const generating =
    submitting ||
    task?.status === "PENDING" ||
    task?.status === "RUNNING" ||
    (!task && (view?.latestTaskStatus === "PENDING" || view?.latestTaskStatus === "RUNNING"));
  const progress = task?.outputPayload?.items ?? [];
  const listingCopy = view?.listingCopy ?? task?.outputPayload?.listingCopy ?? null;
  const viralStyle = view?.viralStyle ?? task?.outputPayload?.viralStyle ?? null;

  async function refreshList() {
    const next = await readApi<ListingSetProjectSummary[]>("/api/listing-set/projects");
    setProjects(next);
  }

  async function openProject(id: string) {
    const next = await readApi<ListingSetView>(`/api/listing-set/projects/${id}`);
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
          const latest = await readApi<ListingSetView>(`/api/listing-set/projects/${view.id}`);
          if (!cancelled) setView(latest);
        }
        if (next.status === "SUCCESS" || next.status === "FAILED" || next.status === "CANCELED") {
          setSubmitting(false);
          await refreshList();
          if (next.status === "FAILED") {
            toast.error(next.errorMessage ?? "套图生成失败");
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

  async function handleAssist() {
    setAssisting(true);
    try {
      const images = await Promise.all(form.files.slice(0, 4).map(async (file) => {
        const payload = await fileToBase64Payload(file);
        return `data:${payload.mimeType};base64,${payload.base64Data}`;
      }));
      const result = await readApi<{ sellingPointsText: string }>("/api/listing-set/copy-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images,
          notes: form.sellingPoints,
          platform: form.platform,
          market: form.market,
          contentLanguage: form.contentLanguage,
        }),
      });
      setForm((current) => ({ ...current, sellingPoints: result.sellingPointsText }));
      toast.success("卖点已扩写，可再改一改再生成");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "卖点扩写失败");
    } finally {
      setAssisting(false);
    }
  }

  async function handleViralAssist() {
    if (!form.files.length) {
      toast.error("请先上传商品原图，再做爆款风格分析");
      return;
    }
    setViralAssisting(true);
    try {
      const images = await Promise.all(form.files.slice(0, 4).map(async (file) => {
        const payload = await fileToBase64Payload(file);
        return `data:${payload.mimeType};base64,${payload.base64Data}`;
      }));
      const result = await readApi<ListingSetViralStyle>("/api/listing-set/viral-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images,
          notes: form.sellingPoints,
          platform: form.platform,
          market: form.market,
          contentLanguage: form.contentLanguage,
        }),
      });
      setForm((current) => ({ ...current, analyzeViralStyle: true, viralStyle: result }));
      toast.success("爆款风格已分析，生成时会按这个调性出图");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "爆款风格分析失败");
    } finally {
      setViralAssisting(false);
    }
  }

  async function handleSubmit() {
    if (!form.files.length) {
      toast.error("请先上传商品原图");
      return;
    }
    setSubmitting(true);
    setTask(null);
    try {
      const images = await Promise.all(form.files.map((file) => fileToBase64Payload(file)));
      const result = await readApi<{ taskId: string; projectId: string }>("/api/listing-set/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images,
          platform: form.platform,
          market: form.market,
          contentLanguage: form.contentLanguage,
          aspectRatio: form.aspectRatio,
          sellingPoints: form.sellingPoints,
          structureMode: form.structureMode,
          groupCounts: form.groupCounts,
          analyzeViralStyle: form.analyzeViralStyle,
          generateListingCopy: form.generateListingCopy,
        }),
      });
      setTaskId(result.taskId);
      const next = await readApi<ListingSetView>(`/api/listing-set/projects/${result.projectId}`);
      setView(next);
      toast.success("已开始生成套图");
      await refreshList();
    } catch (error) {
      setSubmitting(false);
      toast.error(error instanceof Error ? error.message : "套图任务创建失败");
    }
  }

  async function handleRegenerate(sectionId: string) {
    if (!view) return;
    try {
      await readApi(`/api/projects/${view.id}/sections/${sectionId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      toast.success("正在重绘这一张");
      const latest = await readApi<ListingSetView>(`/api/listing-set/projects/${view.id}`);
      setView(latest);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "重绘失败");
    }
  }

  async function handleCopy() {
    if (!listingCopy) return;
    const text = [
      listingCopy.listingTitle,
      "",
      ...listingCopy.sellingPoints.map((item, index) => `${index + 1}. ${item}`),
      "",
      listingCopy.description,
      listingCopy.keywords.join(" "),
    ].join("\n");
    await navigator.clipboard.writeText(text);
    toast.success("上架文案已复制");
  }

  const recent = useMemo(() => projects.slice(0, 8), [projects]);

  return (
    <div className="flex min-h-0 flex-col gap-4 md:h-[calc(100dvh-10.5rem)]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">商品套图</h1>
          <p className="mt-1 text-sm text-slate-500">给货架主图用的 Listing 套图，不是详情长图。</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          onClick={() => {
            setForm(emptyListingSetForm());
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
                <span className="text-slate-400">{item.slotCount ? `${item.slotCount} 张` : "生成中"}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="-mx-5 grid rounded-[1.6rem] border border-slate-200/80 bg-white/55 dark:border-white/10 dark:bg-black/20 md:-mx-8 md:min-h-0 md:flex-1 md:grid-cols-[22.5rem_minmax(0,1fr)] md:overflow-hidden">
        <aside className="flex flex-col border-b border-slate-200/80 p-5 dark:border-white/10 md:h-full md:min-h-0 md:overflow-hidden md:border-b-0 md:border-r">
          <ListingSetForm
            values={form}
            disabled={generating}
            assisting={assisting}
            viralAssisting={viralAssisting}
            onChange={setForm}
            onAssist={() => void handleAssist()}
            onViralAssist={() => void handleViralAssist()}
            onSubmit={() => void handleSubmit()}
          />
        </aside>
        <section className="min-w-0 bg-slate-50/70 p-5 dark:bg-white/[0.02] md:min-h-0 md:overflow-y-auto md:p-8">
          <ListingSetCanvas
            view={view}
            progress={progress}
            listingCopy={listingCopy}
            viralStyle={viralStyle}
            generating={generating}
            onOpen={setLightbox}
            onDownload={(url, name) => void downloadImage(url, name)}
            onDownloadAll={() => {
              const images = (view?.slots ?? []).filter((slot) => slot.imageUrl);
              images.forEach((slot, index) => {
                if (slot.imageUrl) void downloadImage(slot.imageUrl, `listing-${index + 1}.png`);
              });
            }}
            onCopy={() => void handleCopy()}
            onRegenerate={(sectionId) => void handleRegenerate(sectionId)}
          />
        </section>
      </div>

      {lightbox ? (
        <button
          type="button"
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-6"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="套图预览" className="max-h-full max-w-full rounded-3xl object-contain" />
        </button>
      ) : null}
    </div>
  );
}
