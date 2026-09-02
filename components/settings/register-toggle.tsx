/**
 * [INPUT]: 依赖 sonner、Card 区块、PATCH /api/settings
 * [OUTPUT]: 对外提供 RegisterToggle，OWNER 开关开放注册
 * [POS]: components/settings 的唯一控件，被 /settings 页消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

"use client";

import { useState } from "react";
import { toast } from "sonner";

type RegisterToggleProps = {
  initialAllowRegister: boolean;
};

export function RegisterToggle({ initialAllowRegister }: RegisterToggleProps) {
  const [allowRegister, setAllowRegister] = useState(initialAllowRegister);
  const [saving, setSaving] = useState(false);

  async function onToggle(next: boolean) {
    const previous = allowRegister;
    setAllowRegister(next);
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowRegister: next }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "保存失败");
      }
      setAllowRegister(Boolean(payload.data?.allowRegister));
      toast.success(next ? "已开放注册" : "已关闭注册");
    } catch (error) {
      setAllowRegister(previous);
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-background p-3">
      <input
        type="checkbox"
        checked={allowRegister}
        disabled={saving}
        onChange={(event) => void onToggle(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-input"
      />
      <div className="space-y-1">
        <p className="text-sm font-medium">开放注册</p>
        <p className="text-xs leading-6 text-muted-foreground">
          开启后，未登录访客可在登录页进入注册并创建 MEMBER 账号。关闭后仅管理员可在用户管理中添加成员。系统初始化 OWNER 不受此开关影响。
        </p>
      </div>
    </label>
  );
}
