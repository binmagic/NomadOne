/**
 * [INPUT]: 依赖 SidebarNav、ApiUsageIndicator、UserSessionChip、当前 UserProfile
 * [OUTPUT]: 对外提供 AppShell，作为登录后工作区骨架
 * [POS]: layout 的根壳，被 app/(app)/layout.tsx 挂载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import Link from "next/link";
import { Settings2 } from "lucide-react";

import { ApiUsageIndicator } from "@/components/layout/api-usage-indicator";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { FloatingThemeToggle } from "@/components/layout/theme-toggle";
import { UserSessionChip } from "@/components/layout/user-session-chip";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/types/domain";

const appName = "NomadOne";

export function AppShell({ children, user }: { children: React.ReactNode; user: UserProfile }) {
  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100">
      <div className="fixed bottom-4 left-4 z-[60]">
        <FloatingThemeToggle />
      </div>
      <div className="mx-auto min-h-screen max-w-[1600px] px-4 py-5 md:px-6">
        <aside
          className="scrollbar-hidden fixed top-5 z-40 hidden h-[calc(100vh-2.5rem)] w-72 overflow-y-auto rounded-[2rem] border border-white/70 bg-white/76 p-5 shadow-soft backdrop-blur-2xl dark:border-white/10 dark:bg-[#0b0b0c]/88 dark:shadow-[0_24px_60px_-38px_rgba(0,0,0,0.72)] md:flex md:flex-col"
          style={{ left: "max(1.5rem, calc((100vw - 1600px) / 2 + 1.5rem))" }}
        >
          <Link
            href="/"
            className="flex items-center gap-3 rounded-2xl border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(245,245,245,0.82))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          >
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-white">
              <img src="/brand-icon.ico" alt={appName} className="h-full w-full object-cover" suppressHydrationWarning />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">{appName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">AI 商品图文工作台</p>
            </div>
          </Link>

          <SidebarNav isOwner={user.role === "OWNER"} />
        </aside>

        <main className="min-w-0 rounded-[2rem] border border-white/80 bg-white/74 p-5 shadow-soft backdrop-blur-2xl dark:border-white/10 dark:bg-[#0f0f10]/82 dark:shadow-[0_24px_60px_-38px_rgba(0,0,0,0.78)] md:ml-[19.5rem] md:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-end gap-3">
            <Link
              href="/monitor/usage"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-10 gap-2 rounded-2xl border-slate-200 bg-white px-3 shadow-sm hover:bg-white dark:border-white/10 dark:bg-black/30 dark:hover:border-white/20 dark:hover:bg-white/8",
              )}
            >
              <span className="text-sm font-medium">API 监控</span>
              <ApiUsageIndicator />
            </Link>
            <Link href="/settings/providers" className={cn(buttonVariants({ variant: "default" }))}>
              <Settings2 className="mr-2 h-4 w-4" />
              AI 配置
            </Link>
            <UserSessionChip user={user} />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
