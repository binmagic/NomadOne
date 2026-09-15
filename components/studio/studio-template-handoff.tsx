/**
 * [INPUT]: 依赖 next/navigation 的 useSearchParams、/api/prompts/[id]
 * [OUTPUT]: 对外提供 StudioTemplateHandoff；消化 ?template= 后填入 composer 并清掉查询
 * [POS]: components/studio 的深链接消化器，被 StudioWorkspace 用 Suspense 挂载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import type { PromptTemplateView } from "@/types/domain";

type ApiPayload<T> = {
  success: boolean;
  data?: T;
  error?: { message?: string };
};

export function StudioTemplateHandoff({ onApply }: { onApply: (prompt: string) => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const applied = useRef<string | null>(null);

  useEffect(() => {
    const id = searchParams.get("template");
    if (!id || applied.current === id) return;
    applied.current = id;

    let cancelled = false;

    async function run() {
      try {
        const response = await fetch(`/api/prompts/${id}`);
        const payload = (await response.json()) as ApiPayload<PromptTemplateView>;
        if (!payload.success || !payload.data) {
          throw new Error(payload.error?.message ?? "提示词不存在");
        }
        if (!cancelled) {
          onApply(payload.data.prompt);
          router.replace("/studio");
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "无法填入提示词");
          router.replace("/studio");
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [searchParams, router, onApply]);

  return null;
}
