/**
 * [INPUT]: 依赖 next/link、lucide 图标、当前用户是否 OWNER
 * [OUTPUT]: 对外提供 SidebarNav，按路径高亮；OWNER 才看到用户管理
 * [POS]: layout 的侧栏导航，被 AppShell 挂载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenText, FolderKanban, GalleryVerticalEnd, History, Images, Users } from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "快速开始", icon: FolderKanban },
  { href: "/batch-create", label: "批量创建", icon: Images },
  { href: "/history", label: "历史记录", icon: History },
  { href: "/xiaohongshu/plan", label: "小红书图文", icon: BookOpenText },
  { href: "/projects/new", label: "高级创建", icon: GalleryVerticalEnd },
];

export function SidebarNav({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const items = isOwner ? [...navItems, { href: "/settings/users", label: "用户管理", icon: Users }] : navItems;

  return (
    <nav className="mt-6 space-y-2">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all duration-200",
              isActive
                ? "bg-white text-slate-950 shadow-sm dark:bg-white/10 dark:text-white"
                : "text-slate-600 hover:bg-white/85 hover:text-slate-950 hover:shadow-sm dark:text-slate-300 dark:hover:bg-white/8 dark:hover:text-white",
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
