/**
 * [INPUT]: 依赖 ConfirmDialog、Button、/api/auth/logout
 * [OUTPUT]: 对外提供 UserSessionChip
 * [POS]: 工作台顶栏账号入口，挂在 AppShell 标题行右侧
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/types/domain";

export function UserSessionChip({ user }: { user: UserProfile }) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error?.message ?? "退出失败");
      }
      toast.success("已退出");
      window.location.href = "/login";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "退出失败");
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-10 gap-2 rounded-2xl border-slate-200 bg-white px-3 shadow-sm hover:bg-white dark:border-white/10 dark:bg-black/30 dark:hover:border-white/20 dark:hover:bg-white/8",
        )}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-100">
          {(user.displayName || user.username).slice(0, 1).toUpperCase()}
        </span>
        <span className="max-w-[8rem] truncate text-sm font-medium">{user.displayName || user.username}</span>
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-50 w-56 rounded-[28px] border border-border bg-white p-4 shadow-[0_24px_80px_rgba(0,0,0,0.18)] dark:border-white/10 dark:bg-[#111214]">
          <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{user.displayName || user.username}</p>
          <p className="mt-1 text-xs text-slate-500">@{user.username} · {user.role === "OWNER" ? "管理员" : "成员"}</p>
          <button
            type="button"
            className="mt-4 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/8"
            onClick={() => {
              setOpen(false);
              setConfirmOpen(true);
            }}
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmOpen}
        title="退出登录？"
        description="退出后需要重新输入账号才能进入工作台。"
        confirmText="确认退出"
        loading={loading}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={logout}
      />
    </div>
  );
}
