/**
 * [INPUT]: 依赖门户弹层、ImageDropzone、fileToBase64Payload、create/updatePromptTemplateSchema
 * [OUTPUT]: 对外提供 PromptFormDialog，覆盖新建与编辑；创建必须带效果图，编辑可保留原图
 * [POS]: components/prompts 的表单入口，被 PromptLibrary 打开
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { ImageDropzone } from "@/components/shared/image-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fileToBase64Payload } from "@/lib/utils/base64-upload";
import { createPromptTemplateSchema, updatePromptTemplateSchema } from "@/lib/validations/prompt-template";
import type { PromptTemplateView } from "@/types/domain";

const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

export type PromptFormValues = {
  title: string;
  prompt: string;
  image?: string;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-rose-600 dark:text-rose-300">{message}</p>;
}

async function encodeImage(file: File) {
  if (file.size > 4 * 1024 * 1024) {
    toast.error(`${file.name} 超过 4MB，请压缩后再附。`);
    return null;
  }
  const payload = await fileToBase64Payload(file);
  return `data:${payload.mimeType};base64,${payload.base64Data}`;
}

export function PromptFormDialog({
  open,
  mode,
  loading,
  initial,
  error,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  loading: boolean;
  initial: PromptTemplateView | null;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: PromptFormValues) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; prompt?: string; image?: string }>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setPrompt(initial?.prompt ?? "");
    setImage(null);
    setFieldErrors({});
  }, [open, initial]);

  if (!mounted || !open) {
    return null;
  }

  const isCreate = mode === "create";
  const preview = image ?? initial?.previewUrl ?? null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="关闭提示词表单"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={() => {
          if (!loading) onCancel();
        }}
      />
      <form
        noValidate
        className="relative z-[121] max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[28px] border border-border bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)] dark:border-white/10 dark:bg-[#111214]"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = isCreate
            ? createPromptTemplateSchema.safeParse({ title, prompt, image: image ?? "" })
            : updatePromptTemplateSchema.safeParse({ title, prompt, ...(image ? { image } : {}) });
          if (!parsed.success) {
            const flattened = parsed.error.flatten().fieldErrors;
            setFieldErrors({
              title: flattened.title?.[0],
              prompt: flattened.prompt?.[0],
              image: flattened.image?.[0] ?? parsed.error.flatten().formErrors[0],
            });
            return;
          }
          onSubmit({
            title: parsed.data.title ?? title,
            prompt: parsed.data.prompt ?? prompt,
            image: parsed.data.image,
          });
        }}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-900 dark:bg-white/8 dark:text-slate-100">
            {isCreate ? <Sparkles className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}
          </div>
          <div className="min-w-0 space-y-1">
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{isCreate ? "新建提示词" : "编辑提示词"}</h3>
            <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
              {isCreate ? "效果图会印在卡片上，工作区所有人都能选用。" : "不换图就保留当前效果图。"}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt-title">
              标题
              <span aria-hidden="true" className="ml-0.5 text-rose-500">
                *
              </span>
            </Label>
            <Input id="prompt-title" value={title} maxLength={40} onChange={(event) => setTitle(event.target.value)} />
            <FieldError message={fieldErrors.title} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prompt-body">
              提示词
              <span aria-hidden="true" className="ml-0.5 text-rose-500">
                *
              </span>
            </Label>
            <Textarea id="prompt-body" value={prompt} maxLength={4000} className="min-h-[140px]" onChange={(event) => setPrompt(event.target.value)} />
            <FieldError message={fieldErrors.prompt} />
          </div>
          <div className="space-y-2">
            <Label>
              效果图
              {isCreate ? (
                <span aria-hidden="true" className="ml-0.5 text-rose-500">
                  *
                </span>
              ) : null}
            </Label>
            <ImageDropzone
              multiple={false}
              accept={IMAGE_ACCEPT}
              aria-label="上传效果图"
              className="overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 transition hover:bg-slate-50 dark:border-white/15 dark:bg-white/[0.04] dark:hover:bg-white/[0.06]"
              onFiles={(files) => {
                const file = files[0];
                if (!file) return;
                void encodeImage(file).then((dataUrl) => {
                  if (dataUrl) {
                    setImage(dataUrl);
                    setFieldErrors((current) => ({ ...current, image: undefined }));
                  }
                });
              }}
            >
              {preview ? (
                <img src={preview} alt="" className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 text-sm text-slate-500">
                  <ImagePlus className="h-6 w-6" />
                  点击或拖入一张效果图
                </div>
              )}
            </ImageDropzone>
            <FieldError message={fieldErrors.image} />
          </div>
          {error ? <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-xl" disabled={loading} onClick={onCancel}>
            取消
          </Button>
          <Button type="submit" className="rounded-xl" disabled={loading}>
            {loading ? "保存中…" : "保存"}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
