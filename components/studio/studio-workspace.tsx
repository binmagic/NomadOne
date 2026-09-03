/**
 * [INPUT]: 依赖 /api/studio/conversations、fileToBase64Payload、PageHeader/ConfirmDialog、lucide
 * [OUTPUT]: 对外提供 StudioWorkspace；发送后立即入队，轮询 PENDING 直到服务器写回图片
 * [POS]: components/studio 的唯一工作台，被 app/(app)/studio/page.tsx 挂载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  ImagePlus,
  Loader2,
  MessageSquarePlus,
  Send,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatDate } from "@/lib/utils";
import { fileToBase64Payload } from "@/lib/utils/base64-upload";
import type {
  StudioAspectRatio,
  StudioConversationSummary,
  StudioConversationView,
  StudioMessageView,
} from "@/types/domain";
import { studioAspectRatios } from "@/types/domain";

type ApiPayload<T> = {
  success: boolean;
  data?: T;
  error?: { message?: string };
};

type Attachment = {
  fileName: string;
  dataUrl: string;
};

async function readApi<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = (await response.json()) as ApiPayload<T>;
  if (!payload.success || payload.data === undefined) {
    throw new Error(payload.error?.message ?? "请求失败");
  }
  return payload.data;
}

function aspectClass(aspectRatio: StudioAspectRatio | null) {
  if (aspectRatio === "3:4") return "aspect-[3/4]";
  if (aspectRatio === "9:16") return "aspect-[9/16]";
  return "aspect-square";
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

export function StudioWorkspace({ initialConversations }: { initialConversations: StudioConversationSummary[] }) {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<StudioConversationView | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [sending, setSending] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [aspectRatio, setAspectRatio] = useState<StudioAspectRatio>("1:1");
  const [pendingDelete, setPendingDelete] = useState<StudioConversationSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const messages = active?.messages ?? [];
  const hasPending = useMemo(() => messages.some((item) => item.status === "PENDING"), [messages]);
  const watchedPending = useRef(false);

  useEffect(() => {
    if (!activeId || !hasPending) return;
    let cancelled = false;

    async function tick() {
      try {
        const conversation = await readApi<StudioConversationView>(`/api/studio/conversations/${activeId}`);
        if (!cancelled) {
          setActive(conversation);
          setConversations((current) => {
            const summary: StudioConversationSummary = {
              id: conversation.id,
              title: conversation.title,
              previewUrl: conversation.previewUrl,
              createdAt: conversation.createdAt,
              updatedAt: conversation.updatedAt,
            };
            return [summary, ...current.filter((item) => item.id !== conversation.id)];
          });
        }
      } catch {
        // 轮询失败时下一拍再试，不打断后台出图
      }
    }

    const timer = window.setInterval(() => void tick(), 2000);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeId, hasPending]);

  useEffect(() => {
    if (watchedPending.current && !hasPending && active) {
      const failed = [...active.messages].reverse().find((item) => item.role === "ASSISTANT" && item.status === "FAILED");
      if (failed?.errorMessage) {
        toast.error(failed.errorMessage);
      }
    }
    watchedPending.current = hasPending;
  }, [hasPending, active]);

  async function openConversation(id: string) {
    setActiveId(id);
    setLoadingConversation(true);
    try {
      const conversation = await readApi<StudioConversationView>(`/api/studio/conversations/${id}`);
      setActive(conversation);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载对话失败");
    } finally {
      setLoadingConversation(false);
    }
  }

  useEffect(() => {
    const firstId = initialConversations[0]?.id;
    if (firstId) {
      void openConversation(firstId);
    }
    // 仅首屏带入历史会话
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages.length, sending]);

  const lastFailed = useMemo(
    () => [...messages].reverse().find((item) => item.role === "ASSISTANT" && item.status === "FAILED") ?? null,
    [messages],
  );

  async function handleNewConversation() {
    try {
      const created = await readApi<StudioConversationView>("/api/studio/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setConversations((current) => [
        {
          id: created.id,
          title: created.title,
          previewUrl: created.previewUrl,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        },
        ...current,
      ]);
      setActiveId(created.id);
      setActive(created);
      setPrompt("");
      setAttachments([]);
      composerRef.current?.focus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "无法新建对话");
    }
  }

  async function handleAttach(files: FileList | null) {
    if (!files?.length) return;
    const next: Attachment[] = [...attachments];
    for (const file of Array.from(files)) {
      if (next.length >= 4) break;
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 4 * 1024 * 1024) {
        toast.error(`${file.name} 超过 4MB，请压缩后再附。`);
        continue;
      }
      const payload = await fileToBase64Payload(file);
      next.push({
        fileName: payload.fileName,
        dataUrl: `data:${payload.mimeType};base64,${payload.base64Data}`,
      });
    }
    setAttachments(next);
  }

  async function handleSend() {
    const text = prompt.trim();
    if (!text && attachments.length === 0) {
      toast.error("先写一句要生成或修改的说明。");
      return;
    }
    if (!text) {
      toast.error("附图之外还需要一句说明。");
      return;
    }
    if (sending || hasPending) return;

    setSending(true);
    try {
      let conversationId = activeId;
      if (!conversationId) {
        const created = await readApi<StudioConversationView>("/api/studio/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        conversationId = created.id;
        setActiveId(created.id);
        setActive(created);
        setConversations((current) => [
          {
            id: created.id,
            title: created.title,
            previewUrl: created.previewUrl,
            createdAt: created.createdAt,
            updatedAt: created.updatedAt,
          },
          ...current.filter((item) => item.id !== created.id),
        ]);
      }

      const result = await readApi<StudioConversationView>(`/api/studio/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          images: attachments.map((item) => item.dataUrl),
          aspectRatio,
        }),
      });

      setActive(result);
      setConversations((current) => {
        const summary: StudioConversationSummary = {
          id: result.id,
          title: result.title,
          previewUrl: result.previewUrl,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt,
        };
        return [summary, ...current.filter((item) => item.id !== result.id)];
      });
      setPrompt("");
      setAttachments([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发送失败");
    } finally {
      setSending(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await readApi(`/api/studio/conversations/${pendingDelete.id}`, { method: "DELETE" });
      const remaining = conversations.filter((item) => item.id !== pendingDelete.id);
      setConversations(remaining);
      if (activeId === pendingDelete.id) {
        if (remaining[0]) {
          await openConversation(remaining[0].id);
        } else {
          setActiveId(null);
          setActive(null);
        }
      }
      setPendingDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="对话生图"
        title="用一句话出图，下一句接着改"
        description="出图在服务器进行。关掉页面或换浏览器登录，回来就能看到结果。不附图时下一句改上一张。"
        actions={
          <Button type="button" onClick={() => void handleNewConversation()} className="rounded-2xl">
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            新对话
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="rounded-[1.75rem] border border-white/70 bg-white/55 p-3 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-black/25">
          <p className="px-3 pb-2 pt-1 text-xs font-medium uppercase tracking-[0.22em] text-slate-400">会话</p>
          <div className="max-h-[28vh] space-y-1 overflow-y-auto xl:max-h-[calc(100vh-16rem)]">
            {conversations.length === 0 ? (
              <p className="px-3 py-6 text-sm leading-6 text-slate-500">还没有对话。右边写一句，直接开画。</p>
            ) : (
              conversations.map((item) => {
                const selected = item.id === activeId;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "group flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors",
                      selected
                        ? "bg-white text-slate-950 shadow-sm dark:bg-white/10 dark:text-white"
                        : "text-slate-600 hover:bg-white/80 dark:text-slate-300 dark:hover:bg-white/8",
                    )}
                  >
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => void openConversation(item.id)}>
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-black/5 bg-slate-100 dark:border-white/10 dark:bg-white/5">
                        {item.previewUrl ? (
                          <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Wand2 className="h-4 w-4 text-slate-400" />
                          </div>
                        )}
                      </div>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{item.title}</span>
                        <span className="block truncate text-[11px] text-slate-400">{formatDate(item.updatedAt)}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                      aria-label="删除对话"
                      onClick={() => setPendingDelete(item)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <section className="flex min-h-[70vh] flex-col overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/60 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-black/30">
          <div ref={scrollerRef} className="flex-1 space-y-5 overflow-y-auto px-4 py-5 md:px-6">
            {loadingConversation && !active ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在打开对话
              </div>
            ) : messages.length === 0 ? (
              <EmptyHint />
            ) : (
              messages.map((message) => <MessageBubble key={message.id} message={message} onOpen={setLightbox} />)
            )}
            {sending && !hasPending ? <GeneratingBubble /> : null}
          </div>

          <div className="border-t border-black/5 bg-white/70 p-4 dark:border-white/10 dark:bg-black/40 md:p-5">
            {attachments.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {attachments.map((item, index) => (
                  <div key={`${item.fileName}-${index}`} className="relative h-16 w-16 overflow-hidden rounded-2xl border border-black/5">
                    <img src={item.dataUrl} alt={item.fileName} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-full bg-black/70 p-0.5 text-white"
                      aria-label="移除图片"
                      onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mb-3 flex flex-wrap items-center gap-2">
              {studioAspectRatios.map((ratio) => (
                <Button
                  key={ratio}
                  type="button"
                  size="sm"
                  variant={aspectRatio === ratio ? "default" : "outline"}
                  className="h-8 rounded-xl px-3"
                  onClick={() => setAspectRatio(ratio)}
                >
                  {ratio}
                </Button>
              ))}
              <span className="text-xs text-slate-400">比例只影响这一轮</span>
            </div>

            <div className="flex items-end gap-2">
              <label className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-11 cursor-pointer rounded-2xl px-3")}>
                <ImagePlus className="h-4 w-4" />
                <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => void handleAttach(event.target.files)} />
              </label>
              <Textarea
                ref={composerRef}
                value={prompt}
                placeholder="例如：白底产品主图，陶瓷杯居中，柔和影棚光…"
                className="min-h-[44px] flex-1 resize-none rounded-2xl py-3"
                disabled={sending || hasPending}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <Button type="button" className="h-11 rounded-2xl px-4" disabled={sending || hasPending} onClick={() => void handleSend()}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            {hasPending ? (
              <p className="mt-2 text-xs leading-5 text-slate-400">正在服务器出图。关掉页面再打开，结果会写在这个对话里。</p>
            ) : lastFailed?.errorMessage && !sending ? (
              <p className="mt-2 text-xs leading-5 text-rose-500">{lastFailed.errorMessage}</p>
            ) : (
              <p className="mt-2 text-xs leading-5 text-slate-400">Enter 发送，Shift+Enter 换行。最多附 4 张图。</p>
            )}
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="删除这组对话？"
        description="生成图会一并从本地存储里清掉，不能恢复。"
        confirmText="删除"
        destructive
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(null)}
      />

      {lightbox ? (
        <button
          type="button"
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-6"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-3xl object-contain shadow-2xl" />
        </button>
      ) : null}
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="flex h-full min-h-[42vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
        <Wand2 className="h-6 w-6 text-slate-700 dark:text-slate-200" />
      </div>
      <p className="text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">从一句话开始</p>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
        先描述画面，或丢一张要改的底图。生成之后继续打字，就是在改上一张。
      </p>
    </div>
  );
}

function GeneratingBubble() {
  return (
    <div className="flex justify-start">
      <div className="rounded-3xl border border-black/5 bg-white/90 px-4 py-3 text-sm text-slate-500 shadow-sm dark:border-white/10 dark:bg-white/5">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        正在出图，通常需要一会儿
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onOpen,
}: {
  message: StudioMessageView;
  onOpen: (url: string) => void;
}) {
  const isUser = message.role === "USER";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[min(36rem,100%)] space-y-3 rounded-3xl px-4 py-3 shadow-sm",
          isUser
            ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
            : "border border-black/5 bg-white/90 text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-100",
        )}
      >
        {message.referenceUrls.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {message.referenceUrls.map((url) => (
              <button key={url} type="button" className="h-16 w-16 overflow-hidden rounded-2xl" onClick={() => onOpen(url)}>
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}

        {message.status === "PENDING" ? (
          <p className="text-sm leading-6 text-slate-500">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            {message.content || "正在出图"}
          </p>
        ) : message.content ? (
          <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
        ) : null}

        {message.imageUrl ? (
          <div className="space-y-2">
            <button
              type="button"
              className={cn("block w-full overflow-hidden rounded-2xl bg-slate-100 dark:bg-black/30", aspectClass(message.aspectRatio))}
              onClick={() => onOpen(message.imageUrl as string)}
            >
              <img src={message.imageUrl} alt={message.content} className="h-full w-full object-cover" />
            </button>
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[11px] opacity-60">{message.modelId ?? "image"} · {message.aspectRatio ?? "1:1"}</p>
              <Button
                type="button"
                size="sm"
                variant={isUser ? "secondary" : "outline"}
                className="h-8 rounded-xl"
                onClick={() => void downloadImage(message.imageUrl as string, `nomadone-studio-${message.id}.png`)}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                下载
              </Button>
            </div>
          </div>
        ) : null}

        {message.status === "FAILED" && message.errorMessage ? (
          <p className="text-xs leading-5 text-rose-500">{message.errorMessage}</p>
        ) : null}
      </div>
    </div>
  );
}
