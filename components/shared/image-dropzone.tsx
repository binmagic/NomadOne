/**
 * [INPUT]: 依赖 cn、sonner
 * [OUTPUT]: 对外提供 ImageDropzone 与 pickImageFiles。点击与拖放都产出 File[]，不编码、不上传
 * [POS]: components/shared 的图片拾取器。被 quick-start / batch-create / listing-set-form / project-creator 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

const IMAGE_EXT = /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i;

export function pickImageFiles(list: FileList | File[] | null | undefined, multiple = true): File[] {
  if (!list) return [];
  const images = Array.from(list).filter(
    (file) => file.type.startsWith("image/") || (!file.type && IMAGE_EXT.test(file.name)),
  );
  return multiple ? images : images.slice(0, 1);
}

function hasFilePayload(event: { dataTransfer?: DataTransfer | null }) {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("button, a, input, textarea, select, [data-no-drop-click]"));
}

export function ImageDropzone(props: {
  id?: string;
  multiple?: boolean;
  disabled?: boolean;
  accept?: string;
  captureDocumentDrop?: boolean;
  className?: string;
  activeClassName?: string;
  "aria-label"?: string;
  children: ReactNode;
  onFiles: (files: File[]) => void;
}) {
  const autoId = useId();
  const inputId = props.id ?? autoId;
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const onFilesRef = useRef(props.onFiles);
  const disabledRef = useRef(Boolean(props.disabled));
  const captureRef = useRef(Boolean(props.captureDocumentDrop));
  const multipleRef = useRef(Boolean(props.multiple));
  const [active, setActive] = useState(false);

  onFilesRef.current = props.onFiles;
  disabledRef.current = Boolean(props.disabled);
  captureRef.current = Boolean(props.captureDocumentDrop);
  multipleRef.current = Boolean(props.multiple);

  const multiple = Boolean(props.multiple);
  const disabled = Boolean(props.disabled);
  const accept = props.accept ?? "image/*";

  function resetDrag() {
    setActive(false);
  }

  function isOutsideZone(event: DragEvent<HTMLDivElement>) {
    const related = event.relatedTarget;
    return !(related instanceof Node && event.currentTarget.contains(related));
  }

  function emit(list: FileList | File[] | null | undefined, source: "input" | "drop") {
    const picked = list ? Array.from(list) : [];
    if (source === "input" && picked.length === 0) return;
    const files = pickImageFiles(picked, multipleRef.current);
    if (files.length === 0) {
      toast.error("请拖入或选择图片文件");
      return;
    }
    onFilesRef.current(files);
  }

  function onDragEnter(event: DragEvent<HTMLDivElement>) {
    if (disabled || !hasFilePayload(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (isOutsideZone(event)) setActive(true);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    if (disabled || !hasFilePayload(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    if (disabled || !hasFilePayload(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (isOutsideZone(event)) resetDrag();
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    resetDrag();
    emit(event.dataTransfer.files, "drop");
    if (inputRef.current) inputRef.current.value = "";
  }

  function onClick(event: MouseEvent<HTMLDivElement>) {
    if (disabled || isInteractiveTarget(event.target)) return;
    inputRef.current?.click();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled || event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputRef.current?.click();
    }
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    emit(event.target.files, "input");
    event.currentTarget.value = "";
  }

  useEffect(() => {
    function onWindowDragOver(event: globalThis.DragEvent) {
      if (!hasFilePayload(event)) return;
      event.preventDefault();
    }

    function onWindowDrop(event: globalThis.DragEvent) {
      if (!hasFilePayload(event)) return;
      event.preventDefault();
      if (!captureRef.current || disabledRef.current) return;
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      const picked = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : [];
      const files = pickImageFiles(picked, multipleRef.current);
      if (files.length === 0) {
        toast.error("请拖入或选择图片文件");
        return;
      }
      onFilesRef.current(files);
    }

    window.addEventListener("dragover", onWindowDragOver);
    window.addEventListener("drop", onWindowDrop);
    return () => {
      window.removeEventListener("dragover", onWindowDragOver);
      window.removeEventListener("drop", onWindowDrop);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      role="group"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={props["aria-label"] ?? "上传图片"}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        props.className,
        active && (props.activeClassName ?? "border-slate-400 bg-slate-50/90 dark:border-white/30 dark:bg-white/[0.08]"),
      )}
    >
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="hidden"
        onChange={onInputChange}
        onClick={(event) => event.stopPropagation()}
      />
      {props.children}
    </div>
  );
}
