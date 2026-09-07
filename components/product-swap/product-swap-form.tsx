/**
 * [INPUT]: 依赖 domain 比例、ImageDropzone、Button/Textarea
 * [OUTPUT]: 对外提供 ProductSwapForm，收集场景实拍 / 本品图 / 比例 / 备注后提交
 * [POS]: components/product-swap 的左栏表单，被 ProductSwapWorkspace 挂载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2, UploadCloud } from "lucide-react";

import { ImageDropzone } from "@/components/shared/image-dropzone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { studioAspectRatios, type StudioAspectRatio } from "@/types/domain";

export type ProductSwapFormValues = {
  sceneFile: File | null;
  productFile: File | null;
  aspectRatio: StudioAspectRatio;
  notes: string;
};

export const emptyProductSwapForm = (): ProductSwapFormValues => ({
  sceneFile: null,
  productFile: null,
  aspectRatio: "3:4",
  notes: "",
});

function FileThumb({ file, disabled, onRemove }: { file: File; disabled?: boolean; onRemove: () => void }) {
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
        disabled={disabled}
        className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-500 opacity-0 shadow-sm transition group-hover:opacity-100 dark:bg-black/70 dark:text-slate-200"
        aria-label="移除图片"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function SlotDropzone(props: {
  label: string;
  hint: string;
  file: File | null;
  disabled?: boolean;
  captureDocumentDrop?: boolean;
  ariaLabel: string;
  onFile: (file: File | null) => void;
}) {
  return (
    <section className="space-y-3">
      <div>
        <Label className="text-sm text-slate-800 dark:text-slate-100">{props.label}</Label>
        <p className="mt-1 text-xs leading-5 text-slate-400">{props.hint}</p>
      </div>
      {props.file ? (
        <FileThumb file={props.file} disabled={props.disabled} onRemove={() => props.onFile(null)} />
      ) : (
        <ImageDropzone
          multiple={false}
          disabled={props.disabled}
          captureDocumentDrop={props.captureDocumentDrop}
          aria-label={props.ariaLabel}
          className="flex cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-slate-300 bg-white/60 px-4 py-8 text-center transition hover:bg-slate-50 dark:border-white/15 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
          onFiles={(files) => props.onFile(files[0] ?? null)}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-black/30">
            <UploadCloud className="h-4 w-4" />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-100">点击或拖拽上传</p>
          <p className="mt-1 text-xs text-slate-400">一张即可</p>
        </ImageDropzone>
      )}
    </section>
  );
}

export function ProductSwapForm(props: {
  values: ProductSwapFormValues;
  disabled?: boolean;
  onChange: (next: ProductSwapFormValues) => void;
  onSubmit: () => void;
}) {
  const { values, disabled, onChange } = props;
  const canSubmit = Boolean(values.sceneFile && values.productFile) && !disabled;

  return (
    <form
      className="flex flex-col md:min-h-0 md:flex-1"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) props.onSubmit();
      }}
    >
      <div className="space-y-6 pr-1 md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain">
        <SlotDropzone
          label="场景实拍"
          hint="达人/玩家原图，人、手、环境全留。"
          file={values.sceneFile}
          disabled={disabled}
          captureDocumentDrop
          ariaLabel="上传场景实拍"
          onFile={(file) => onChange({ ...values, sceneFile: file })}
        />
        <SlotDropzone
          label="本品图"
          hint="只换这个货。白底或实物均可。"
          file={values.productFile}
          disabled={disabled}
          ariaLabel="上传本品图"
          onFile={(file) => onChange({ ...values, productFile: file })}
        />

        <section className="space-y-3">
          <Label className="text-sm text-slate-800 dark:text-slate-100">画面比例</Label>
          <div className="flex flex-wrap gap-2">
            {studioAspectRatios.map((option) => (
              <button
                key={option}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ ...values, aspectRatio: option })}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition",
                  values.aspectRatio === option
                    ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-300",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <Label className="text-sm text-slate-800 dark:text-slate-100">备注（可选）</Label>
          <Textarea
            value={values.notes}
            disabled={disabled}
            maxLength={500}
            placeholder="手持方式、产品朝向等。不要写精修、美化。"
            onChange={(event) => onChange({ ...values, notes: event.target.value })}
          />
        </section>
      </div>

      <div className="mt-6 shrink-0 pt-2">
        <Button type="submit" className="h-12 w-full rounded-full" disabled={!canSubmit}>
          {disabled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          生成换品图
        </Button>
      </div>
    </form>
  );
}
