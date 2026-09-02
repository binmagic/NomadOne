/**
 * [INPUT]: 依赖 Input/Label/Button、sonner、PATCH /api/settings、validations/settings 超时常量
 * [OUTPUT]: 对外提供 ModelTimeoutField，OWNER 配置单次模型调用超时
 * [POS]: components/settings 的超时控件，被 /settings 页与 RegisterToggle 并列
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MODEL_TIMEOUT_MS_MAX,
  MODEL_TIMEOUT_MS_MIN,
} from "@/lib/validations/settings";

const MIN_SECONDS = MODEL_TIMEOUT_MS_MIN / 1000;
const MAX_SECONDS = MODEL_TIMEOUT_MS_MAX / 1000;

export function ModelTimeoutField({ initialModelTimeoutMs }: { initialModelTimeoutMs: number }) {
  const [seconds, setSeconds] = useState(String(Math.round(initialModelTimeoutMs / 1000)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = Number(seconds);
    if (!Number.isInteger(parsed) || parsed < MIN_SECONDS || parsed > MAX_SECONDS) {
      setError(`请输入 ${MIN_SECONDS} 到 ${MAX_SECONDS} 之间的整数秒`);
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelTimeoutMs: parsed * 1000 }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "保存失败");
      }
      setSeconds(String(Math.round(Number(payload.data?.modelTimeoutMs ?? parsed * 1000) / 1000)));
      toast.success(`模型超时已设为 ${parsed} 秒`);
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="model-timeout-seconds">超时时间（秒）</Label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            id="model-timeout-seconds"
            type="number"
            min={MIN_SECONDS}
            max={MAX_SECONDS}
            step={1}
            value={seconds}
            disabled={saving}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "model-timeout-error" : undefined}
            className={error ? "border-rose-400 focus-visible:ring-rose-400 sm:max-w-[180px]" : "sm:max-w-[180px]"}
            onChange={(event) => {
              setSeconds(event.target.value);
              if (error) {
                setError(null);
              }
            }}
          />
          <Button type="submit" disabled={saving} className="rounded-xl sm:w-auto">
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
        {error ? (
          <p id="model-timeout-error" className="text-sm text-rose-600 dark:text-rose-300">
            {error}
          </p>
        ) : (
          <p className="text-xs leading-6 text-muted-foreground">
            作用于文本生成、结构化输出和图像生成。连接测试与模型列表仍使用 15 秒短超时。可设 {MIN_SECONDS}–{MAX_SECONDS} 秒。
          </p>
        )}
      </div>
    </form>
  );
}
